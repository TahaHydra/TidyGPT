import type {
  ActionResult, CleanupJob, ConversationCandidate, PlatformId, RulesConfig,
} from '@tidygpt/shared';
import { defaultSettings } from '@tidygpt/shared';
import { calculateScore, classifyScore, evaluateRules } from '@tidygpt/core';
import {
  getJob, getSettings, saveConversationBackup, saveLog, updateJob,
} from '@tidygpt/storage';
import { PlatformAdapters } from '@tidygpt/ui-automation';

console.log('[TidyGPT] Multi-platform background worker initialized.');

let activeJobId: string | null = null;
let isPaused = false;
let isCancelled = false;
let contentScanRunning = false;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const candidateKey = (candidate: ConversationCandidate) => candidate.providerKey ?? `${candidate.platform ?? 'chatgpt'}:${candidate.id}`;

async function mergeCandidates(candidates: ConversationCandidate[]) {
  const data = await chrome.storage.local.get(['tidygptCandidates']);
  const existing = (data.tidygptCandidates || []) as ConversationCandidate[];
  const map = new Map(existing.map(candidate => [candidateKey(candidate), candidate]));
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    map.set(key, { ...map.get(key), ...candidate, providerKey: key });
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
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      if (!candidate.url) continue;
      try {
      if (!workerTabId) {
        const tab = await chrome.tabs.create({ url: candidate.url, active: false });
        workerTabId = tab.id;
        if (!workerTabId) throw new Error('Could not create scanner tab');
      } else {
        await chrome.tabs.update(workerTabId, { url: candidate.url, active: false });
      }
      await waitForTab(workerTabId, candidate.url);
      const response = await chrome.tabs.sendMessage(workerTabId, {
        type: 'READ_CURRENT_CONVERSATION',
        payload: { messageLimit: settings.contentScanMessageLimit ?? 20 },
      });
      if (!response?.ok) throw new Error(response?.error || `Could not read ${candidate.title}`);

      const scanText: string = response.scanText ?? '';
      const protectedMatches = settings.protectedKeywords.filter(keyword =>
        keyword.trim() && scanText.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())
      );
      const updatedAt = response.updatedAt;
      const ageDays = updatedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000))
        : undefined;
      const riskFlags = candidate.riskFlags.filter(flag => flag !== 'low_confidence_selector');
      if (protectedMatches.length && !riskFlags.includes('protected_keyword')) riskFlags.push('protected_keyword');
      if (response.hasCode && !riskFlags.includes('has_code')) riskFlags.push('has_code');
      if (response.hasFile && !riskFlags.includes('has_files')) riskFlags.push('has_files');

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
      const ruleOverride = evaluateRules(scanned, rules, scanText);
      scanned.recommendation = classifyScore(scanned.score, settings, riskFlags, ruleOverride);
      await saveConversationBackup({ ...response.backup, title: candidate.title || response.backup.title });
      await mergeCandidates([scanned]);
      } catch (error: any) {
        failures.push(`${candidate.title || candidate.id}: ${error.message}`);
        await mergeCandidates([{
          ...candidate,
          providerKey: candidateKey(candidate),
          riskFlags: Array.from(new Set([...candidate.riskFlags, 'unknown_state' as const])),
          recommendation: 'uncertain',
          status: 'failed',
        }]);
      }
      await chrome.storage.local.set({
        tidygptScanProgress: { platform, status: 'scanning', completed: index + 1, total: candidates.length, failures: failures.length },
      });
    }
    await chrome.storage.local.set({
      tidygptScanProgress: { platform, status: failures.length ? 'completed_with_errors' : 'completed', completed: candidates.length, total: candidates.length, failures },
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
  let completedCount = 0;

  for (const candidate of queue) {
    if (isCancelled) break;
    while (isPaused && !isCancelled) await wait(500);
    if (isCancelled) break;
    const platform = candidate.platform ?? 'chatgpt';
    const tab = await findPlatformTab(platform);
    let result: ActionResult;
    try {
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
    scanPlatformHistory(message.payload.platform, message.payload.candidates);
    sendResponse({ ok: true }); return false;
  }
  if (message.type === 'EXECUTE_ACTION_PLAN') { runJob(message.payload.jobId); sendResponse({ ok: true }); return false; }
  if (message.type === 'PAUSE_JOB') { isPaused = true; if (activeJobId) updateJob(activeJobId, { status: 'paused' }); sendResponse({ ok: true }); return false; }
  if (message.type === 'RESUME_JOB') { isPaused = false; if (activeJobId) updateJob(activeJobId, { status: 'executing' }); sendResponse({ ok: true }); return false; }
  if (message.type === 'CANCEL_JOB') { isCancelled = true; isPaused = false; sendResponse({ ok: true }); return false; }
  if (message.type === 'SAVE_CANDIDATES') {
    mergeCandidates(message.payload).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
