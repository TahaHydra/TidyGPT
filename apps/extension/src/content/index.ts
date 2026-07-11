import {
  detectPlatform,
  executeAction,
  getPlatformAdapter,
  parseConversationId,
  runAllProbes,
} from '@tidygpt/ui-automation';
import type { ConversationCandidate, ConversationBackup, PlatformId } from '@tidygpt/shared';

console.info("[TidyGPT] Multi-platform content script loaded", location.href);
(window as any).__TIDYGPT_LOADED = true;

const platform = detectPlatform();
const adapter = platform ? getPlatformAdapter(platform) : null;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function emptyScore(confidence: number) {
  return {
    total: 0, shortConversation: 0, oldAge: 0, genericTitle: 0,
    duplicateTitle: 0, noFiles: 0, noCode: 0, noProject: 0,
    noProtectedKeyword: 0, lowContentLength: 0, confidence,
  };
}

function discoverVisibleChats(): ConversationCandidate[] {
  if (!adapter || !platform) return [];
  const currentId = adapter.conversationPath.exec(location.pathname)?.[1];
  const seen = new Set<string>();
  const candidates: ConversationCandidate[] = [];

  for (const link of Array.from(document.querySelectorAll(adapter.conversationLink)) as HTMLAnchorElement[]) {
    const id = parseConversationId(link.href, adapter);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = link.innerText.trim() || link.getAttribute("aria-label") || link.getAttribute("title") || "Untitled";
    const providerKey = `${platform}:${id}`;
    candidates.push({
      id, providerKey, platform, idHash: providerKey, title, url: link.href,
      source: "live_ui", sourceConfidence: 0.85,
      dates: { dateConfidence: 0 }, counts: { countConfidence: 0 },
      signals: {
        genericTitle: /^(new chat|nouvelle discussion|untitled)$/i.test(title),
        duplicateTitle: false, hasCode: "unknown", hasFile: "unknown", hasImage: "unknown",
        hasArtifact: "unknown", isProject: "unknown", isCurrentChat: currentId === id,
        protectedKeywordMatches: [],
      },
      score: emptyScore(0.85),
      riskFlags: currentId === id ? ["current_chat"] : ["low_confidence_selector"],
      recommendation: "uncertain", selectedAction: "none", status: "discovered",
    });
  }
  return candidates;
}

function findScrollContainer(): HTMLElement | null {
  if (!adapter) return null;
  const elements = adapter.scrollContainers.flatMap(selector =>
    Array.from(document.querySelectorAll(selector)) as HTMLElement[]
  );
  return elements.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0]
    ?? document.querySelector(adapter.sidebar) as HTMLElement | null;
}

async function reportDiscovery(payload: Record<string, unknown>) {
  try { await chrome.runtime.sendMessage({ type: 'DISCOVERY_PROGRESS', payload: { platform, ...payload } }); }
  catch { /* Dashboard progress is helpful but must never stop discovery. */ }
}

async function performDeepScan(idleRounds = 10, stepDelayMs = 650, maxConversations = 0, maxScrollPages = 5) {
  const scrollContainer = findScrollContainer();
  if (!scrollContainer) return discoverVisibleChats();

  const originalTop = scrollContainer.scrollTop;
  const candidates = new Map<string, ConversationCandidate>();
  let unchangedRounds = 0;
  let previousHeight = -1;
  let rounds = 0;
  let scrollPages = 0;
  scrollContainer.scrollTop = 0;
  await wait(300);
  await reportDiscovery({ status: 'discovering', found: 0, rounds: 0, scrollPages: 0, idleRounds, maxConversations, maxScrollPages });

  // Completion is based on repeated no-progress observations, not a history-size cap.
  for (let guard = 0; guard < 10_000 && unchangedRounds < Math.max(2, idleRounds); guard++) {
    rounds = guard + 1;
    const before = candidates.size;
    for (const candidate of discoverVisibleChats()) candidates.set(candidate.providerKey!, candidate);
    if (maxConversations > 0 && candidates.size >= maxConversations) break;
    if (maxScrollPages > 0 && scrollPages >= maxScrollPages) break;

    const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    const nextTop = Math.min(maxTop, scrollContainer.scrollTop + Math.max(240, scrollContainer.clientHeight * 0.6));
    scrollContainer.scrollTop = nextTop;
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    scrollPages++;
    await wait(Math.max(250, stepDelayMs));

    const atBottom = scrollContainer.scrollTop >= maxTop;
    const listChanged = candidates.size > before || scrollContainer.scrollHeight !== previousHeight;
    // Only count completion rounds while the list is genuinely stable at its
    // bottom. Normal virtualized scrolling cannot end discovery early.
    unchangedRounds = atBottom && !listChanged ? unchangedRounds + 1 : 0;
    if (guard % 3 === 0 || atBottom) {
      await reportDiscovery({ status: 'discovering', found: candidates.size, rounds, scrollPages, bottomIdleRounds: unchangedRounds, idleRounds, maxConversations, maxScrollPages });
    }
    previousHeight = scrollContainer.scrollHeight;
  }

  scrollContainer.scrollTop = originalTop;
  const titleCounts = new Map<string, number>();
  for (const candidate of candidates.values()) {
    const normalized = (candidate.title ?? '').trim().toLocaleLowerCase();
    titleCounts.set(normalized, (titleCounts.get(normalized) ?? 0) + 1);
  }
  for (const candidate of candidates.values()) {
    const normalized = (candidate.title ?? '').trim().toLocaleLowerCase();
    candidate.signals.duplicateTitle = normalized !== 'new chat' && (titleCounts.get(normalized) ?? 0) > 1;
  }
  const result = Array.from(candidates.values()).slice(0, maxConversations > 0 ? maxConversations : undefined);
  await reportDiscovery({
    status: 'discovered', found: result.length, rounds, scrollPages,
    reason: maxConversations > 0 && result.length >= maxConversations ? 'maximum_reached'
      : maxScrollPages > 0 && scrollPages >= maxScrollPages ? 'scroll_page_limit_reached' : 'sidebar_complete',
  });
  return result;
}

async function waitForConversation() {
  if (!adapter) return false;
  let stable = 0;
  let previousCount = -1;
  for (let attempt = 0; attempt < 80; attempt++) {
    const count = document.querySelectorAll(adapter.messageRoots).length;
    if (count === 0 && attempt % 4 === 0) {
      const pageError = detectConversationLoadError();
      if (pageError) throw new Error(pageError);
    }
    const busy = !!document.querySelector(adapter.loading) || !!document.querySelector(adapter.generating);
    stable = !busy && count > 0 && count === previousCount ? stable + 1 : 0;
    if (stable >= 3) return true;
    previousCount = count;
    await wait(250);
  }
  return false;
}

function detectConversationLoadError() {
  const text = (document.body?.innerText || '').slice(0, 20_000);
  if (/too many requests|rate limit|try again later|error 429/i.test(text)) return 'Rate limited by the AI site (too many requests)';
  if (/temporarily unavailable|something went wrong|failed to load/i.test(text)) return 'Conversation page is temporarily unavailable';
  return '';
}

function extractMessages(): ConversationBackup['messages'] {
  if (!adapter) return [];
  const entries: Array<{ node: Element; role: "user" | "assistant" | "unknown"; text: string }> = [];
  const add = (selector: string, role: "user" | "assistant") => {
    for (const node of Array.from(document.querySelectorAll(selector))) {
      const text = (node as HTMLElement).innerText?.trim();
      if (text) entries.push({ node, role, text });
    }
  };
  add(adapter.userMessages, 'user');
  add(adapter.assistantMessages, 'assistant');
  entries.sort((a, b) => a.node === b.node ? 0 : (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const seen = new Set<string>();
  return entries.flatMap(entry => {
    const key = `${entry.role}:${entry.text}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ role: entry.role, text: entry.text }];
  });
}

async function readCurrentConversation(messageLimit = 20) {
  if (!adapter || !platform) throw new Error('Unsupported platform');
  const loaded = await waitForConversation();
  const id = adapter.conversationPath.exec(location.pathname)?.[1];
  if (!id) throw new Error('This is not a conversation URL');
  const messages = extractMessages();
  if (!loaded || messages.length === 0) {
    throw new Error(detectConversationLoadError() || 'No messages loaded from this conversation');
  }
  const limit = Math.max(1, messageLimit);
  const sampled = messages.length <= limit * 2
    ? messages
    : [...messages.slice(0, limit), ...messages.slice(-limit)];
  const title = document.title.replace(/\s*[|–-]\s*(ChatGPT|Claude|Gemini).*$/i, '').trim() || 'Untitled';
  const times = Array.from(document.querySelectorAll('time[datetime]'));
  const time = times[times.length - 1]?.getAttribute('datetime') ?? undefined;
  const backup: ConversationBackup = {
    providerKey: `${platform}:${id}`, platform, id, title, url: location.href,
    capturedAt: new Date().toISOString(), messages,
  };
  return {
    backup,
    scanText: sampled.map(item => item.text).join('\n'),
    counts: {
      user: messages.filter(item => item.role === 'user').length,
      assistant: messages.filter(item => item.role === 'assistant').length,
      total: messages.length,
    },
    updatedAt: time,
    hasCode: messages.some(item => /```|<pre|\b(function|class|const|let|var)\s+[\w$]+/i.test(item.text)),
    hasFile: !!document.querySelector('a[download], [data-testid*="attachment" i], [data-test-id*="attachment" i]'),
    hasImage: !!document.querySelector('main img, [role="main"] img'),
    hasArtifact: !!document.querySelector('[data-testid*="artifact" i], [data-test-id*="artifact" i], [class*="artifact"]'),
  };
}

async function saveCandidates(candidates: ConversationCandidate[]) {
  return chrome.runtime.sendMessage({ type: "SAVE_CANDIDATES", payload: candidates });
}

function injectTidyGPTBadge() {
  if (!adapter || !platform || document.getElementById("tidygpt-floating-tools")) return;
  const tools = document.createElement('div');
  tools.id = 'tidygpt-floating-tools';
  Object.assign(tools.style, {
    position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147483647', display: 'flex', gap: '7px',
    font: '500 13px system-ui, sans-serif',
  });
  const badge = document.createElement("button");
  badge.id = "tidygpt-floating-badge";
  badge.textContent = `Scan ${adapter.label}`;
  Object.assign(badge.style, {
    padding: "10px 14px",
    borderRadius: "8px", border: "1px solid rgba(255,255,255,.18)", background: "#18181b",
    color: "#f4f4f5", font: "500 13px system-ui, sans-serif", boxShadow: "0 12px 24px rgba(0,0,0,.3)", cursor: "pointer",
  });
  const dashboard = document.createElement('button');
  dashboard.textContent = 'TidyGPT Dashboard';
  Object.assign(dashboard.style, {
    padding: '10px 14px', borderRadius: '8px', border: '1px solid #2563eb', background: '#1d4ed8',
    color: '#fff', font: '600 13px system-ui, sans-serif', boxShadow: '0 12px 24px rgba(0,0,0,.3)', cursor: 'pointer',
  });
  dashboard.onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  badge.onclick = async () => {
    badge.disabled = true;
    badge.textContent = `Discovering ${adapter.label}…`;
    try {
      const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      const candidates = await performDeepScan(
        settings?.deepScanIdleRounds ?? 10,
        settings?.deepScanStepDelayMs ?? 650,
        settings?.deepScanMaxConversations ?? 0,
        settings?.deepScanMaxScrollPages ?? 5,
      );
      await saveCandidates(candidates);
      badge.textContent = `Found ${candidates.length} · open Dashboard to audit`;
    } catch (error: any) {
      badge.textContent = `Scan failed: ${error?.message ?? 'unknown error'}`;
    } finally {
      setTimeout(() => {
        badge.textContent = `Scan ${adapter.label}`;
        badge.disabled = false;
      }, 4000);
    }
  };
  tools.append(badge, dashboard);
  document.documentElement.appendChild(tools);
}

injectTidyGPTBadge();
let badgeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
new MutationObserver(() => {
  if (badgeDebounceTimer) return;
  badgeDebounceTimer = setTimeout(() => { badgeDebounceTimer = null; injectTidyGPTBadge(); }, 2000);
}).observe(document.body, { childList: true, subtree: false });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') { sendResponse({ ok: true, platform }); return; }
  if (message.type === 'DIAGNOSTICS') {
    sendResponse({ ok: true, platform, health: runAllProbes(), url: location.href }); return;
  }
  if (message.type === 'READ_CURRENT_CONVERSATION') {
    readCurrentConversation(message.payload?.messageLimit).then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'EXECUTE_ACTION') {
    const { id, action, platform: requestedPlatform } = message.payload;
    executeAction(id, action, requestedPlatform as PlatformId | undefined)
      .then(success => sendResponse({ success }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
