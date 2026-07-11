import type {
  ActionResult, CleanerSettings, CleanupJob, ConversationCandidate, CustomRule, PlatformId, RiskFlag,
  RuleConditions, RulesConfig, SavedConversationDecision,
} from '@tidygpt/shared';
import { defaultSettings } from '@tidygpt/shared';
import { calculateScore, classifyScore, evaluateRulesDetailed } from '@tidygpt/core';
import {
  getConversationBackup, getJob, getSettings, saveConversationBackup, saveLog, updateJob,
} from '@tidygpt/storage';
import { PlatformAdapters } from '@tidygpt/ui-automation';

console.log('[TidyGPT] Multi-platform background worker initialized.');

let activeJobId: string | null = null;
let isPaused = false;
let isCancelled = false;
let contentScanRunning = false;
let contentScanCancelled = false;
let contentScanStopReason = '';
let plannedAuditRunning = false;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitForContentScan(ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (contentScanCancelled) return false;
    await wait(Math.min(500, until - Date.now()));
  }
  return !contentScanCancelled;
}
function isRetryableScanError(error: unknown) {
  return /too many|rate.?limit|\b429\b|try again|temporar|timed out|no messages|failed to fetch/i.test(String((error as any)?.message || error));
}
const candidateKey = (candidate: ConversationCandidate) => candidate.providerKey ?? `${candidate.platform ?? 'chatgpt'}:${candidate.id}`;

async function mergeCandidates(candidates: ConversationCandidate[]) {
  const data = await chrome.storage.local.get(['tidygptCandidates', 'tidygptSavedDecisions']);
  const existing = (data.tidygptCandidates || []) as ConversationCandidate[];
  const saved = new Map(((data.tidygptSavedDecisions || []) as SavedConversationDecision[]).map(item => [item.providerKey, item]));
  const map = new Map(existing.map(candidate => [candidateKey(candidate), candidate]));
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const decision = saved.get(key);
    const previous = map.get(key);
    const rediscovered = candidate.status === 'discovered' && !!previous;
    const merged: ConversationCandidate = {
      ...previous, ...candidate, providerKey: key,
      userDecision: decision?.decision,
      recommendation: decision ? 'protected' : candidate.recommendation,
      selectedAction: decision ? 'none' : candidate.selectedAction,
    };
    if (rediscovered && previous) {
      const previousContentSignals = !!previous.contentScannedAt || previous.source === 'export';
      merged.source = previous.source;
      merged.sourceConfidence = Math.max(previous.sourceConfidence, candidate.sourceConfidence);
      merged.dates = previous.dates.dateConfidence >= candidate.dates.dateConfidence ? previous.dates : candidate.dates;
      merged.counts = previous.counts.countConfidence >= candidate.counts.countConfidence ? previous.counts : candidate.counts;
      merged.signals = {
        ...candidate.signals,
        ...(previousContentSignals ? {
          hasCode: previous.signals.hasCode,
          hasFile: previous.signals.hasFile,
          hasImage: previous.signals.hasImage,
          hasArtifact: previous.signals.hasArtifact,
          isProject: previous.signals.isProject,
          protectedKeywordMatches: previous.signals.protectedKeywordMatches,
        } : {}),
      };
      merged.riskFlags = Array.from(new Set([
        ...previous.riskFlags.filter(flag => flag !== 'current_chat' && flag !== 'low_confidence_selector'),
        ...candidate.riskFlags.filter(flag => flag !== 'low_confidence_selector' || !previousContentSignals),
      ]));
      merged.score = previous.score;
      merged.recommendation = decision ? 'protected' : previous.recommendation;
      merged.selectedAction = decision ? 'none' : previous.selectedAction;
      merged.matchedRuleIds = previous.matchedRuleIds;
      merged.matchedRuleNames = previous.matchedRuleNames;
      merged.status = previous.status;
    }
    map.set(key, merged);
  }
  await chrome.storage.local.set({
    tidygptCandidates: Array.from(map.values()),
    tidygptLastScanAt: new Date().toISOString(),
  });
}

async function waitForTab(tabId: number, expectedUrl?: string, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    const atExpectedUrl = !expectedUrl || (tab.url && new URL(tab.url).pathname === new URL(expectedUrl).pathname);
    if (tab.status === 'complete' && atExpectedUrl) {
      for (let ping = 0; ping < 20; ping++) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
          if (response?.ok) return;
        } catch { /* content script may still be starting */ }
        await wait(250);
      }
    }
    await wait(250);
  }
  throw new Error('Timed out waiting for conversation page');
}

async function scanPlatformHistory(platform: PlatformId, candidates: ConversationCandidate[]) {
  if (contentScanRunning) throw new Error('A content scan is already running');
  contentScanRunning = true;
  contentScanCancelled = false;
  contentScanStopReason = '';
  let workerTabId: number | undefined;
  const settings = { ...defaultSettings, ...(await getSettings()) };
  const stored = await chrome.storage.local.get(['tidygptRules']);
  const rules: RulesConfig = {
    builtInSettings: settings,
    customRules: Array.isArray(stored.tidygptRules) ? stored.tidygptRules : [],
  };

  await chrome.storage.local.set({
    tidygptScanProgress: { platform, status: 'scanning', completed: 0, total: candidates.length },
  });

  try {
    const failures: string[] = [];
    const pendingUpdates: ConversationCandidate[] = [];
    for (let index = 0; index < candidates.length; index++) {
      if (contentScanCancelled) break;
      const candidate = candidates[index];
      if (!candidate.url) continue;
      try {
      let response: any;
      const maxRetries = Math.max(0, settings.contentScanMaxRetries ?? 3);
      for (let attempt = 0; ; attempt++) {
        try {
          if (!workerTabId) {
            const tab = await chrome.tabs.create({ url: candidate.url, active: false });
            workerTabId = tab.id;
            if (!workerTabId) throw new Error('Could not create scanner tab');
          } else {
            await chrome.tabs.update(workerTabId, { url: candidate.url, active: false });
          }
          await waitForTab(workerTabId, candidate.url);
          response = await chrome.tabs.sendMessage(workerTabId, {
            type: 'READ_CURRENT_CONVERSATION',
            payload: { messageLimit: settings.contentScanMessageLimit ?? 20 },
          });
          if (!response?.ok) throw new Error(response?.error || `Could not read ${candidate.title}`);
          break;
        } catch (error) {
          const retryable = isRetryableScanError(error);
          if (retryable && attempt >= maxRetries) {
            contentScanStopReason = 'Rate limit persisted after retries; scan stopped to protect the account';
            contentScanCancelled = true;
            throw error;
          }
          if (contentScanCancelled || !retryable) throw error;
          const waitMs = Math.max(10_000, settings.contentScanRetryBaseMs ?? 30_000) * (2 ** attempt);
          await chrome.storage.local.set({
            tidygptScanProgress: {
              platform, status: 'rate_limit_cooldown', completed: index, total: candidates.length,
              currentTitle: candidate.title, retry: attempt + 1, maxRetries, waitMs, failures: failures.length,
            },
          });
          if (!await waitForContentScan(waitMs)) throw new Error('Scan cancelled');
        }
      }

      const scanText: string = response.scanText ?? '';
      const fullText: string = (response.backup.messages as Array<{ text: string }>).map(message => message.text).join('\n');
      const protectedHaystack = `${candidate.title || ''}\n${fullText}`.toLocaleLowerCase();
      const protectedMatches = settings.protectedKeywords.filter(keyword =>
        keyword.trim() && protectedHaystack.includes(keyword.toLocaleLowerCase())
      );
      const updatedAt = response.updatedAt;
      const ageDays = updatedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000))
        : undefined;
      const riskFlags = candidate.riskFlags.filter(flag => flag !== 'low_confidence_selector');
      if (protectedMatches.length && !riskFlags.includes('protected_keyword')) riskFlags.push('protected_keyword');
      if (response.hasCode && !riskFlags.includes('has_code')) riskFlags.push('has_code');
      if (response.hasFile && !riskFlags.includes('has_files')) riskFlags.push('has_files');
      if (response.hasImage && !riskFlags.includes('has_image')) riskFlags.push('has_image');
      if (response.hasArtifact && !riskFlags.includes('has_artifact')) riskFlags.push('has_artifact');
      if (response.hasArtifact && !riskFlags.includes('is_project')) riskFlags.push('is_project');

      const scanned: ConversationCandidate = {
        ...candidate,
        providerKey: candidateKey(candidate),
        platform,
        source: 'hybrid',
        sourceConfidence: 0.92,
        dates: {
          ...candidate.dates, updatedAt: updatedAt ?? candidate.dates.updatedAt,
          ageDays: ageDays ?? candidate.dates.ageDays,
          dateConfidence: updatedAt ? 0.8 : candidate.dates.dateConfidence,
        },
        counts: {
          userMessages: response.counts.user,
          assistantMessages: response.counts.assistant,
          totalMessages: response.counts.total,
          countConfidence: 0.95,
        },
        contentLength: (response.backup.messages as Array<{ text: string }>).reduce((total, message) => total + message.text.length, 0),
        contentScannedAt: new Date().toISOString(),
        backupAvailable: true,
        signals: {
          ...candidate.signals,
          hasCode: !!response.hasCode,
          hasFile: !!response.hasFile,
          hasImage: !!response.hasImage,
          hasArtifact: !!response.hasArtifact,
          isProject: !!response.hasArtifact,
          protectedKeywordMatches: protectedMatches,
        },
        riskFlags,
        score: candidate.score,
        status: 'scanned',
      };
      scanned.score = calculateScore(scanned, settings);
      const evaluation = evaluateRulesDetailed(scanned, rules, scanText);
      scanned.matchedRuleIds = evaluation.matchedRuleIds;
      scanned.matchedRuleNames = evaluation.matchedRuleNames;
      scanned.recommendation = classifyScore(scanned.score, settings, riskFlags, evaluation.decision);
      await saveConversationBackup({ ...response.backup, title: candidate.title || response.backup.title });
      pendingUpdates.push(scanned);
      } catch (error: any) {
        if (contentScanCancelled) break;
        failures.push(`${candidate.title || candidate.id}: ${error.message}`);
        pendingUpdates.push({
          ...candidate,
          providerKey: candidateKey(candidate),
          riskFlags: Array.from(new Set([...candidate.riskFlags, 'unknown_state' as const])),
          recommendation: 'uncertain',
          status: 'failed',
        });
      }
      if (pendingUpdates.length >= 10 || index === candidates.length - 1) {
        await mergeCandidates(pendingUpdates.splice(0));
      }
      await chrome.storage.local.set({
        tidygptScanProgress: { platform, status: 'scanning', completed: index + 1, total: candidates.length, failures: failures.length },
      });
      if (index < candidates.length - 1 && !contentScanCancelled) {
        const minDelay = Math.max(1000, settings.contentScanDelayMinMs ?? 4000);
        const maxDelay = Math.max(minDelay, settings.contentScanDelayMaxMs ?? 7000);
        if (!await waitForContentScan(minDelay + Math.random() * (maxDelay - minDelay))) break;
        const batchSize = Math.max(1, settings.contentScanBatchSize ?? 20);
        if ((index + 1) % batchSize === 0) {
          const cooldownMs = Math.max(0, settings.contentScanBatchCooldownMs ?? 30_000);
          await chrome.storage.local.set({
            tidygptScanProgress: {
              platform, status: 'batch_cooldown', completed: index + 1, total: candidates.length,
              waitMs: cooldownMs, failures: failures.length,
            },
          });
          if (!await waitForContentScan(cooldownMs)) break;
        }
      }
    }
    if (pendingUpdates.length) await mergeCandidates(pendingUpdates.splice(0));
    await chrome.storage.local.set({
      tidygptScanProgress: contentScanCancelled
        ? { platform, status: contentScanStopReason ? 'rate_limited_stopped' : 'cancelled', error: contentScanStopReason || undefined, failures }
        : { platform, status: failures.length ? 'completed_with_errors' : 'completed', completed: candidates.length, total: candidates.length, failures },
    });
  } catch (error: any) {
    await chrome.storage.local.set({
      tidygptScanProgress: { platform, status: 'failed', error: error.message },
    });
  } finally {
    if (workerTabId) await chrome.tabs.remove(workerTabId).catch(() => undefined);
    contentScanRunning = false;
  }
}

function hasRuleConditions(rule: CustomRule) {
  return Object.values(rule.conditions).some(value => value !== undefined && value !== false && value !== '');
}

function inspectRuleRequirements(
  candidate: ConversationCandidate,
  conditions: RuleConditions,
  bodyText: string,
  hasBackup: boolean,
) {
  const missing = new Set<string>();
  const title = (candidate.title || '').toLocaleLowerCase();
  if (conditions.titleContains && !title.includes(conditions.titleContains.toLocaleLowerCase())) return { possible: false, missing };
  if (conditions.titleDoesNotContain && title.includes(conditions.titleDoesNotContain.toLocaleLowerCase())) return { possible: false, missing };
  if (conditions.titleRegex) {
    try { if (!new RegExp(conditions.titleRegex, 'i').test(candidate.title || '')) return { possible: false, missing }; }
    catch { return { possible: false, missing }; }
  }

  const checkNumber = (condition: number | undefined, actual: number | undefined, kind: 'max' | 'min', reason: string) => {
    if (condition == null) return true;
    if (actual == null) { missing.add(reason); return true; }
    return kind === 'max' ? actual <= condition : actual >= condition;
  };
  if (!checkNumber(conditions.maxUserMessages, candidate.counts.userMessages, 'max', 'message counts')) return { possible: false, missing };
  if (!checkNumber(conditions.minUserMessages, candidate.counts.userMessages, 'min', 'message counts')) return { possible: false, missing };
  if (!checkNumber(conditions.maxTotalMessages, candidate.counts.totalMessages, 'max', 'message counts')) return { possible: false, missing };
  if (!checkNumber(conditions.minTotalMessages, candidate.counts.totalMessages, 'min', 'message counts')) return { possible: false, missing };
  if (!checkNumber(conditions.olderThanDays, candidate.dates.ageDays, 'min', 'conversation age')) return { possible: false, missing };
  if (!checkNumber(conditions.newerThanDays, candidate.dates.ageDays, 'max', 'conversation age')) return { possible: false, missing };
  if (!checkNumber(conditions.maxContentLength, candidate.contentLength, 'max', 'content length')) return { possible: false, missing };
  if (!checkNumber(conditions.minContentLength, candidate.contentLength, 'min', 'content length')) return { possible: false, missing };

  if (conditions.bodyContains || conditions.bodyDoesNotContain || conditions.bodyRegex) {
    if (!hasBackup) missing.add('conversation text');
    else {
      const body = bodyText.toLocaleLowerCase();
      if (conditions.bodyContains && !body.includes(conditions.bodyContains.toLocaleLowerCase())) return { possible: false, missing };
      if (conditions.bodyDoesNotContain && body.includes(conditions.bodyDoesNotContain.toLocaleLowerCase())) return { possible: false, missing };
      if (conditions.bodyRegex) {
        try { if (!new RegExp(conditions.bodyRegex, 'i').test(bodyText)) return { possible: false, missing }; }
        catch { return { possible: false, missing }; }
      }
    }
  }

  const checkAbsent = (enabled: boolean | undefined, actual: boolean | 'unknown', reason: string) => {
    if (!enabled) return true;
    if (actual === 'unknown') { missing.add(reason); return true; }
    return actual === false;
  };
  if (!checkAbsent(conditions.noFiles, candidate.signals.hasFile, 'file detection')) return { possible: false, missing };
  if (!checkAbsent(conditions.noCode, candidate.signals.hasCode, 'code detection')) return { possible: false, missing };
  if (!checkAbsent(conditions.noImages, candidate.signals.hasImage, 'image detection')) return { possible: false, missing };
  if (!checkAbsent(conditions.noArtifacts, candidate.signals.hasArtifact, 'artifact detection')) return { possible: false, missing };
  if (!checkAbsent(conditions.noProject, candidate.signals.isProject, 'project detection')) return { possible: false, missing };
  return { possible: true, missing };
}

function actionNeedsSafetyRead(candidate: ConversationCandidate, settings: CleanerSettings, decision: 'archive' | 'delete' | 'keep' | 'none', hasBackup: boolean) {
  const reasons: string[] = [];
  if (decision !== 'archive' && decision !== 'delete') return reasons;
  if (decision === 'delete' && settings.backupBeforeDelete !== false && !hasBackup) reasons.push('pre-delete backup');
  if (settings.protectedKeywords.length && !hasBackup) reasons.push('protected words');
  if (settings.fileBehavior === 'block' && candidate.signals.hasFile === 'unknown') reasons.push('file protection');
  if (settings.codeBehavior === 'block' && candidate.signals.hasCode === 'unknown') reasons.push('code protection');
  if (settings.imageBehavior === 'block' && candidate.signals.hasImage === 'unknown') reasons.push('image protection');
  if (settings.projectBehavior === 'block' && (candidate.signals.isProject === 'unknown' || candidate.signals.hasArtifact === 'unknown')) reasons.push('project protection');
  return reasons;
}

async function prepareRuleAudit() {
  const data = await chrome.storage.local.get(['tidygptCandidates', 'tidygptRules']);
  const candidates = (data.tidygptCandidates || []) as ConversationCandidate[];
  const settings = { ...defaultSettings, ...(await getSettings()) };
  const rules: RulesConfig = {
    builtInSettings: settings,
    customRules: ((data.tidygptRules || []) as CustomRule[]).filter(rule => rule.enabled !== false && hasRuleConditions(rule)),
  };
  const toRead: ConversationCandidate[] = [];
  const reasonCounts = new Map<string, number>();

  for (const candidate of candidates) {
    const backup = await getConversationBackup(candidateKey(candidate));
    const bodyText = backup?.messages.map(message => message.text).join('\n') || '';
    const localCandidate: ConversationCandidate = backup ? {
      ...candidate,
      contentLength: candidate.contentLength ?? bodyText.length,
      counts: {
        ...candidate.counts,
        userMessages: candidate.counts.userMessages ?? backup.messages.filter(message => message.role === 'user').length,
        assistantMessages: candidate.counts.assistantMessages ?? backup.messages.filter(message => message.role === 'assistant').length,
        totalMessages: candidate.counts.totalMessages ?? backup.messages.length,
      },
    } : candidate;
    const candidateReasons = new Set<string>();
    for (const rule of rules.customRules) {
      const inspected = inspectRuleRequirements(localCandidate, rule.conditions, bodyText, !!backup);
      if (!inspected.possible) continue;
      for (const reason of inspected.missing) candidateReasons.add(reason);
    }
    if (!candidateReasons.size) {
      const evaluation = evaluateRulesDetailed(localCandidate, rules, bodyText);
      for (const reason of actionNeedsSafetyRead(localCandidate, settings, evaluation.decision, !!backup)) candidateReasons.add(reason);
    }
    if (candidateReasons.size) {
      toRead.push(candidate);
      for (const reason of candidateReasons) reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  }

  const plan = {
    createdAt: new Date().toISOString(),
    candidateKeys: toRead.map(candidateKey),
    totalDiscovered: candidates.length,
    pagesToOpen: toRead.length,
    alreadyLocal: candidates.length - toRead.length,
    byPlatform: Object.fromEntries((['chatgpt', 'claude', 'gemini'] as PlatformId[]).map(platform => [platform, toRead.filter(candidate => (candidate.platform || 'chatgpt') === platform).length])),
    reasons: Object.fromEntries(reasonCounts),
  };
  await chrome.storage.local.set({ tidygptPendingAuditPlan: plan });
  return plan;
}

async function runPlannedAudit() {
  if (plannedAuditRunning || contentScanRunning) throw new Error('An audit scan is already running');
  plannedAuditRunning = true;
  try {
    const data = await chrome.storage.local.get(['tidygptPendingAuditPlan', 'tidygptCandidates']);
    const plan = data.tidygptPendingAuditPlan as { candidateKeys?: string[] } | undefined;
    const keys = new Set(plan?.candidateKeys || []);
    const candidates = ((data.tidygptCandidates || []) as ConversationCandidate[]).filter(candidate => keys.has(candidateKey(candidate)));
    for (const platform of ['chatgpt', 'claude', 'gemini'] as PlatformId[]) {
      const platformCandidates = candidates.filter(candidate => (candidate.platform || 'chatgpt') === platform);
      if (!platformCandidates.length) continue;
      await scanPlatformHistory(platform, platformCandidates);
      if (contentScanCancelled) return;
    }
    await runRuleAudit();
    await chrome.storage.local.remove('tidygptPendingAuditPlan');
  } finally {
    plannedAuditRunning = false;
  }
}

async function runRuleAudit() {
  const data = await chrome.storage.local.get(['tidygptCandidates', 'tidygptRules', 'tidygptSavedDecisions']);
  const candidates = (data.tidygptCandidates || []) as ConversationCandidate[];
  const settings = { ...defaultSettings, ...(await getSettings()) };
  const rules: RulesConfig = {
    builtInSettings: settings,
    customRules: Array.isArray(data.tidygptRules) ? data.tidygptRules : [],
  };
  const saved = new Map(((data.tidygptSavedDecisions || []) as SavedConversationDecision[]).map(item => [item.providerKey, item]));
  const rulesNeedConversationData = rules.customRules.some(rule => {
    const { titleContains, titleDoesNotContain, titleRegex, ...conversationConditions } = rule.conditions;
    void titleContains; void titleDoesNotContain; void titleRegex;
    return Object.values(conversationConditions).some(value => value !== undefined && value !== false && value !== '');
  });
  let missingContent = 0;
  let unsupportedArchive = 0;

  const audited = await Promise.all(candidates.map(async candidate => {
    const key = candidateKey(candidate);
    const backup = await getConversationBackup(key);
    if (!backup && rulesNeedConversationData) missingContent++;
    const bodyText = backup?.messages.map(message => message.text).join('\n') ?? '';
    const protectedHaystack = `${candidate.title || ''}\n${bodyText}`.toLocaleLowerCase();
    const protectedMatches = settings.protectedKeywords.filter(keyword =>
      keyword.trim() && protectedHaystack.includes(keyword.toLocaleLowerCase())
    );
    const riskFlags: RiskFlag[] = candidate.riskFlags.filter(flag => flag !== 'protected_keyword');
    if (protectedMatches.length) riskFlags.push('protected_keyword');
    const evaluatedCandidate: ConversationCandidate = {
      ...candidate,
      contentLength: candidate.contentLength ?? (backup ? bodyText.length : undefined),
      counts: backup ? {
        ...candidate.counts,
        userMessages: candidate.counts.userMessages ?? backup.messages.filter(message => message.role === 'user').length,
        assistantMessages: candidate.counts.assistantMessages ?? backup.messages.filter(message => message.role === 'assistant').length,
        totalMessages: candidate.counts.totalMessages ?? backup.messages.length,
      } : candidate.counts,
      signals: { ...candidate.signals, protectedKeywordMatches: protectedMatches },
      riskFlags,
    };
    const evaluation = evaluateRulesDetailed(evaluatedCandidate, rules, bodyText);
    const decision = saved.get(key);
    const score = calculateScore(evaluatedCandidate, settings);
    const classified = classifyScore(score, settings, riskFlags, evaluation.decision);
    let recommendation = decision
      ? 'protected' as const
      : evaluation.decision === 'none' && classified !== 'protected' && classified !== 'uncertain'
        ? 'ignore' as const
        : classified;
    const archiveUnsupported = evaluation.decision === 'archive' && !PlatformAdapters[candidate.platform ?? 'chatgpt'].supportsArchive;
    if (archiveUnsupported && !decision) {
      unsupportedArchive++;
      recommendation = 'manual_review';
    }
    return {
      ...evaluatedCandidate,
      score,
      recommendation,
      userDecision: decision?.decision,
      matchedRuleIds: evaluation.matchedRuleIds,
      matchedRuleNames: evaluation.matchedRuleNames,
      selectedAction: decision || evaluation.decision === 'keep' || recommendation === 'protected' || archiveUnsupported
        ? 'none' as const
        : evaluation.decision === 'delete' ? 'delete' as const
          : evaluation.decision === 'archive' ? 'archive' as const : 'none' as const,
    };
  }));

  const summary = {
    auditedAt: new Date().toISOString(),
    total: audited.length,
    archive: audited.filter(item => item.selectedAction === 'archive').length,
    delete: audited.filter(item => item.selectedAction === 'delete').length,
    protected: audited.filter(item => item.recommendation === 'protected').length,
    unmatched: audited.filter(item => item.selectedAction === 'none' && item.recommendation !== 'protected').length,
    missingContent,
    unsupportedArchive,
  };
  await chrome.storage.local.set({ tidygptCandidates: audited, tidygptAuditSummary: summary });
  return summary;
}

async function findPlatformTab(platform: PlatformId) {
  const patterns = PlatformAdapters[platform].hosts.map(host => `*://${host}/*`);
  return (await chrome.tabs.query({ url: patterns }))[0];
}

async function runJob(jobId: string) {
  activeJobId = jobId;
  isPaused = false;
  isCancelled = false;
  const job = await getJob(jobId);
  if (!job) return;
  const hasDelete = job.candidates.some(candidate => candidate.selectedAction === 'delete' || candidate.selectedAction === 'archive_then_delete');
  if (hasDelete && job.settingsSnapshot.backupBeforeDelete !== false && !job.backupCreatedAt) {
    await updateJob(jobId, { status: 'failed', errors: ['Deletion blocked: no pre-delete backup was created.'] });
    activeJobId = null;
    return;
  }
  await updateJob(jobId, { status: 'executing' });
  const queue = job.candidates.filter(candidate => candidate.selectedAction !== 'none');
  const decisionData = await chrome.storage.local.get(['tidygptSavedDecisions']);
  const protectedKeys = new Set(((decisionData.tidygptSavedDecisions || []) as SavedConversationDecision[]).map(item => item.providerKey));
  let completedCount = 0;

  for (const candidate of queue) {
    if (isCancelled) break;
    while (isPaused && !isCancelled) await wait(500);
    if (isCancelled) break;
    const platform = candidate.platform ?? 'chatgpt';
    let result: ActionResult;
    if (protectedKeys.has(candidateKey(candidate)) || candidate.userDecision || candidate.recommendation === 'protected') {
      result = {
        id: candidate.id, action: candidate.selectedAction as ActionResult['action'], status: 'skipped',
        error: 'Skipped because the conversation is protected', timestamp: new Date().toISOString(),
      };
    } else try {
      const tab = await findPlatformTab(platform);
      if (!tab?.id) throw new Error(`No ${PlatformAdapters[platform].label} tab is open`);
      if (candidate.url) {
        await chrome.tabs.update(tab.id, { url: candidate.url });
        await waitForTab(tab.id, candidate.url);
      }
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_ACTION',
        payload: { id: candidate.id, action: candidate.selectedAction, platform },
      });
      const success = response?.success === true;
      result = {
        id: candidate.id, action: candidate.selectedAction as ActionResult['action'],
        status: success ? 'success' : 'failed', error: success ? undefined : response?.error || 'UI verification failed',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      result = {
        id: candidate.id, action: candidate.selectedAction as ActionResult['action'], status: 'failed',
        error: error.message, timestamp: new Date().toISOString(),
      };
    }
    job.results.push(result);
    await saveLog({
      id: crypto.randomUUID(), jobId, timestamp: result.timestamp, source: job.source,
      action: result.action, status: result.status,
      details: { providerKey: candidateKey(candidate), title: candidate.title, error: result.error },
    });
    completedCount++;
    await updateJob(jobId, {
      currentItemId: candidate.id, progress: Math.floor((completedCount / Math.max(1, queue.length)) * 100), results: job.results,
    });
    const min = job.settingsSnapshot.delayMinMs;
    const max = Math.max(min, job.settingsSnapshot.delayMaxMs);
    await wait(min + Math.random() * (max - min));
  }
  await updateJob(jobId, { status: isCancelled ? 'cancelled' : 'completed', progress: isCancelled ? undefined : 100 });
  activeJobId = null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    getSettings().then(settings => sendResponse({ ...defaultSettings, ...settings })); return true;
  }
  if (message.type === 'PING_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async tabs => {
      const tab = tabs[0];
      if (!tab?.id) return sendResponse({ ok: false, reason: 'No active tab' });
      try { sendResponse({ ...(await chrome.tabs.sendMessage(tab.id, { type: 'PING' })), tab }); }
      catch { sendResponse({ ok: false, reason: 'Open ChatGPT, Claude, or Gemini' }); }
    }); return true;
  }
  if (message.type === 'RUN_DIAGNOSTICS') {
    Promise.all((Object.keys(PlatformAdapters) as PlatformId[]).map(async platform => {
      const tab = await findPlatformTab(platform);
      if (!tab?.id) return { platform, ok: false, error: 'No open tab' };
      try { return await chrome.tabs.sendMessage(tab.id, { type: 'DIAGNOSTICS' }); }
      catch (error: any) { return { platform, ok: false, error: error.message }; }
    })).then(sendResponse); return true;
  }
  if (message.type === 'START_CONTENT_SCAN') {
    sendResponse({ ok: false, error: 'Direct full-history reading is disabled. Prepare and approve an audit plan first.' }); return false;
  }
  if (message.type === 'CANCEL_CONTENT_SCAN') {
    if (!contentScanRunning) { sendResponse({ ok: false, error: 'No content scan is running' }); return false; }
    contentScanCancelled = true;
    contentScanStopReason = '';
    sendResponse({ ok: true }); return false;
  }
  if (message.type === 'RUN_RULE_AUDIT') {
    if (contentScanRunning) { sendResponse({ ok: false, error: 'Wait for the content scan to finish before auditing' }); return false; }
    runRuleAudit().then(summary => sendResponse({ ok: true, summary }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'PREPARE_RULE_AUDIT') {
    if (contentScanRunning || plannedAuditRunning) { sendResponse({ ok: false, error: 'Another audit scan is already running' }); return false; }
    prepareRuleAudit().then(plan => sendResponse({ ok: true, plan }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'START_PLANNED_AUDIT') {
    if (contentScanRunning || plannedAuditRunning) { sendResponse({ ok: false, error: 'Another audit scan is already running' }); return false; }
    runPlannedAudit().catch(error => chrome.storage.local.set({
      tidygptScanProgress: { status: 'failed', error: error.message },
    }));
    sendResponse({ ok: true }); return false;
  }
  if (message.type === 'DISCOVERY_PROGRESS') {
    chrome.storage.local.set({
      tidygptDiscoveryProgress: message.payload,
      ...(message.payload?.status === 'discovering' ? { tidygptScanProgress: { status: 'idle', completed: 0, total: 0 } } : {}),
    });
    sendResponse({ ok: true }); return false;
  }
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.runtime.openOptionsPage(); sendResponse({ ok: true }); return false;
  }
  if (message.type === 'EXECUTE_ACTION_PLAN') {
    if (contentScanRunning || plannedAuditRunning) { sendResponse({ ok: false, error: 'Wait for the audit scan to finish before executing actions' }); return false; }
    if (activeJobId) { sendResponse({ ok: false, error: 'Another cleanup job is already running' }); return false; }
    runJob(message.payload.jobId); sendResponse({ ok: true }); return false;
  }
  if (message.type === 'PAUSE_JOB') { isPaused = true; if (activeJobId) updateJob(activeJobId, { status: 'paused' }); sendResponse({ ok: true }); return false; }
  if (message.type === 'RESUME_JOB') { isPaused = false; if (activeJobId) updateJob(activeJobId, { status: 'executing' }); sendResponse({ ok: true }); return false; }
  if (message.type === 'CANCEL_JOB') { isCancelled = true; isPaused = false; sendResponse({ ok: true }); return false; }
  if (message.type === 'SAVE_CANDIDATES') {
    mergeCandidates(message.payload).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
