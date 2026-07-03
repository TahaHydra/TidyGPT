import { CleanupJob, JobState, ActionResult } from '@tidygpt/shared';

console.log('[TidyGPT] Background service worker initialized.');

// In a robust implementation, these would be imported from @tidygpt/storage via a background-friendly bundle
// For simplicity in the extension worker we map messages to the DB functions in the dashboard context,
// or we can import the idb wrapper directly if bundled correctly.
// Given Vite bundles background.ts as an ES module, we can import @tidygpt/storage.
import { getJob, updateJob, saveLog } from '@tidygpt/storage';

let activeJobId: string | null = null;
let isPaused = false;
let isCancelled = false;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[TidyGPT] Installed.');
});

async function runJob(jobId: string) {
  activeJobId = jobId;
  isPaused = false;
  isCancelled = false;

  const job = await getJob(jobId);
  if (!job) return;

  await updateJob(jobId, { status: "executing" });

  let completedCount = 0;
  const queue = job.candidates.filter(c => 
    c.selectedAction === 'archive' || 
    c.selectedAction === 'delete' || 
    c.selectedAction === 'archive_then_delete'
  );

  const total = queue.length;
  
  // Find a ChatGPT tab
  const tabs = await chrome.tabs.query({ url: "*://chatgpt.com/*" });
  const targetTab = tabs[0];

  if (!targetTab?.id) {
    await updateJob(jobId, { status: "failed", errors: ["No ChatGPT tab found to execute actions"] });
    return;
  }

  for (let i = 0; i < total; i++) {
    if (isCancelled) {
      await updateJob(jobId, { status: "cancelled" });
      break;
    }
    while (isPaused) {
      await new Promise(r => setTimeout(r, 1000));
      if (isCancelled) break;
    }
    if (isCancelled) {
      await updateJob(jobId, { status: "cancelled" });
      break;
    }

    const c = queue[i];
    await updateJob(jobId, { currentItemId: c.id });

    // Send action to content script
    try {
      const response: any = await new Promise((resolve) => {
        chrome.tabs.sendMessage(targetTab.id!, { 
          type: 'EXECUTE_ACTION', 
          payload: { id: c.id, action: c.selectedAction }
        }, resolve);
      });

      const success = response?.success === true;
      const result: ActionResult = {
        id: c.id,
        action: c.selectedAction as any,
        status: success ? "success" : "failed",
        error: success ? undefined : (response?.error || "Unknown error"),
        timestamp: new Date().toISOString()
      };
      
      job.results.push(result);
      
      await saveLog({
        id: crypto.randomUUID(),
        jobId,
        timestamp: result.timestamp,
        source: job.source,
        action: result.action,
        status: result.status,
        details: { candidateId: c.id, title: c.title }
      });
      
    } catch (err: any) {
      console.error(err);
    }
    
    completedCount++;
    await updateJob(jobId, { 
      progress: Math.floor((completedCount / total) * 100),
      results: job.results
    });
  }

  if (!isCancelled) {
    await updateJob(jobId, { status: "completed", progress: 100 });
  }
  
  activeJobId = null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && tabs[0].url?.includes("chatgpt.com")) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' }, (response) => {
          sendResponse({ ok: !!response?.ok, tab: tabs[0] });
        });
      } else {
        sendResponse({ ok: false, reason: "Not on chatgpt.com" });
      }
    });
    return true; // async
  }

  if (message.type === 'RUN_DIAGNOSTICS') {
    chrome.tabs.query({ url: "*://chatgpt.com/*" }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DIAGNOSTICS' }, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ error: "No chatgpt.com tab found" });
      }
    });
    return true;
  }

  if (message.type === 'EXECUTE_ACTION_PLAN') {
    runJob(message.payload.jobId);
    sendResponse({ ok: true });
    return false;
  }
  
  if (message.type === 'PAUSE_JOB') {
    isPaused = true;
    sendResponse({ ok: true });
    if (activeJobId) updateJob(activeJobId, { status: "paused" });
    return false;
  }
  
  if (message.type === 'RESUME_JOB') {
    isPaused = false;
    sendResponse({ ok: true });
    if (activeJobId) updateJob(activeJobId, { status: "executing" });
    return false;
  }
  
  if (message.type === 'CANCEL_JOB') {
    isCancelled = true;
    isPaused = false;
    sendResponse({ ok: true });
    return false;
  }
  
  if (message.type === 'SAVE_CANDIDATES') {
    chrome.storage.local.get(["tidygptCandidates"]).then((data) => {
      const existing = (data.tidygptCandidates || []);
      const existingMap = new Map(existing.map((c: any) => [c.id, c]));
      
      for (const c of message.payload) {
        existingMap.set(c.id, c);
      }
    
      return chrome.storage.local.set({
        tidygptCandidates: Array.from(existingMap.values()),
        tidygptLastScanAt: new Date().toISOString()
      });
    }).then(() => {
      sendResponse({ ok: true });
    }).catch(err => {
      console.error("[TidyGPT] Background failed to save candidates:", err);
      sendResponse({ ok: false, error: err.message });
    });
    return true; // async
  }
});
