import { Selectors } from '@tidygpt/ui-automation';
import { executeAction } from '@tidygpt/ui-automation';
import { runAllProbes } from '@tidygpt/ui-automation';
import type { ConversationCandidate } from '@tidygpt/shared';

console.info("[TidyGPT] Content script loaded", location.href);

// Health marker for diagnostic checks from background/popup
(window as any).__TIDYGPT_LOADED = true;

function discoverVisibleChats(): ConversationCandidate[] {
  const links = Array.from(document.querySelectorAll(Selectors.Sidebar.ChatLink)) as HTMLAnchorElement[];
  
  const seen = new Set<string>();
  const candidates: ConversationCandidate[] = [];

  for (const a of links) {
    const href = a.href;
    const url = new URL(href, window.location.origin);
    if (!url.pathname.startsWith('/c/')) continue;
    
    const id = url.pathname.replace('/c/', '');
    if (seen.has(id)) continue;
    seen.add(id);

    const title = a.innerText.trim() || a.getAttribute("aria-label") || a.getAttribute("title") || "Untitled";

    candidates.push({
      id,
      idHash: id,
      title,
      url: href,
      source: "live_ui",
      sourceConfidence: 0.9,
      dates: { dateConfidence: 0 },
      counts: { countConfidence: 0 },
      signals: {
        genericTitle: title.toLowerCase() === 'new chat',
        duplicateTitle: false,
        hasCode: "unknown",
        hasFile: "unknown",
        hasImage: "unknown",
        hasArtifact: "unknown",
        isProject: "unknown",
        isCurrentChat: location.pathname.includes(id),
        protectedKeywordMatches: [],
      },
      score: {
        total: 0,
        shortConversation: 0,
        oldAge: 0,
        genericTitle: 0,
        duplicateTitle: 0,
        noFiles: 0,
        noCode: 0,
        noProject: 0,
        noProtectedKeyword: 0,
        lowContentLength: 0,
        confidence: 0.9
      },
      riskFlags: location.pathname.includes(id) ? ["current_chat"] : [],
      recommendation: "ignore",
      selectedAction: "none",
      status: "discovered"
    });
  }

  return candidates;
}

async function performDeepScan() {
  const scrollContainer = document.querySelector(Selectors.Sidebar.ScrollContainer);
  if (!scrollContainer) return discoverVisibleChats();
  
  const candidates = new Map<string, ConversationCandidate>();
  let lastHeight = 0;
  
  // Lazy scrolling scan
  for (let i = 0; i < 20; i++) { // limit arbitrary deep scan depth for safety
    const visible = discoverVisibleChats();
    for (const c of visible) candidates.set(c.id, c);
    
    scrollContainer.scrollBy(0, 500);
    await new Promise(r => setTimeout(r, 800));
    
    if (scrollContainer.scrollTop === lastHeight) break; // reached bottom
    lastHeight = scrollContainer.scrollTop;
  }
  
  return Array.from(candidates.values());
}

async function countMessagesInCurrentChat(): Promise<{ user: number, assistant: number, ok: boolean }> {
  // Wait for stable DOM
  let stableCount = 0;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (!document.querySelector(Selectors.Conversation.LoadingSkeleton)) {
      stableCount++;
      if (stableCount > 3) break;
    } else {
      stableCount = 0;
    }
  }

  const userMessages = document.querySelectorAll(Selectors.Conversation.UserMessage).length;
  const assistantMessages = document.querySelectorAll(Selectors.Conversation.AssistantMessage).length;
  
  // Detect if generating
  const isGenerating = !!document.querySelector(Selectors.Conversation.StopGeneratingButton);
  return {
    user: userMessages,
    assistant: assistantMessages,
    ok: !isGenerating && (userMessages > 0 || assistantMessages > 0)
  };
}

async function saveCandidates(candidates: ConversationCandidate[]) {
  // Send message to background script to save candidates to avoid chrome.storage permission issues in content script
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SAVE_CANDIDATES", payload: candidates }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[TidyGPT] Error saving candidates:", chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

function injectTidyGPTBadge() {
  if (document.getElementById("tidygpt-floating-badge")) return;

  const badge = document.createElement("button");
  badge.id = "tidygpt-floating-badge";
  badge.textContent = "TidyGPT Scan";
  badge.style.position = "fixed";
  badge.style.right = "18px";
  badge.style.bottom = "18px";
  badge.style.zIndex = "2147483647";
  badge.style.padding = "10px 14px";
  badge.style.borderRadius = "8px";
  badge.style.border = "1px solid rgba(255,255,255,.18)";
  badge.style.background = "#18181b";
  badge.style.color = "#f4f4f5";
  badge.style.font = "500 13px system-ui, sans-serif";
  badge.style.boxShadow = "0 12px 24px rgba(0,0,0,.3)";
  badge.style.cursor = "pointer";
  badge.style.transition = "all 0.2s";

  badge.onmouseover = () => { badge.style.background = "#27272a"; };
  badge.onmouseout = () => { badge.style.background = "#18181b"; };

  badge.onclick = async () => {
    badge.textContent = "Scanning...";
    badge.style.opacity = "0.7";
    const candidates = await performDeepScan();
    await saveCandidates(candidates);
    badge.textContent = `Found ${candidates.length}`;
    setTimeout(() => { badge.textContent = "TidyGPT Scan"; badge.style.opacity = "1"; }, 3000);
  };

  document.documentElement.appendChild(badge);
}

injectTidyGPTBadge();
let badgeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (badgeDebounceTimer) return;
  badgeDebounceTimer = setTimeout(() => {
    badgeDebounceTimer = null;
    injectTidyGPTBadge();
  }, 2000);
});
observer.observe(document.body, { childList: true, subtree: false });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true });
    return;
  }
  
  if (message.type === 'DIAGNOSTICS') {
    const health = runAllProbes();
    sendResponse({ ok: true, health, url: location.href });
    return;
  }
  
  if (message.type === 'COUNT_MESSAGES') {
    countMessagesInCurrentChat().then(sendResponse);
    return true;
  }

  if (message.type === 'EXECUTE_ACTION') {
    const { id, action } = message.payload;
    executeAction(id, action).then(success => {
      sendResponse({ success });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; 
  }
});
