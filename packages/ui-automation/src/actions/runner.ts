import { findMenuItemByText, findButtonByText } from '../selectors/helpers';
import { getPlatformAdapter, parseConversationId } from '../platforms';
import type { PlatformId } from '@tidygpt/shared';

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeAction(conversationId: string, action: "archive" | "delete" | "archive_then_delete", platform?: PlatformId): Promise<boolean> {
  const adapter = getPlatformAdapter(platform);
  console.log(`[UI Automation] Executing ${action} on ${adapter.label}:${conversationId}`);

  if ((action === "archive" || action === "archive_then_delete") && !adapter.supportsArchive) {
    console.error(`[UI Automation] ${adapter.label} does not expose a native archive action.`);
    return false;
  }

  if (action === "archive_then_delete") {
    const archiveOk = await executeAction(conversationId, "archive", adapter.id);
    if (!archiveOk) {
      console.error(`[UI Automation] Archive step failed for ${conversationId}, aborting delete.`);
      return false;
    }
    // After archive the link should be gone; delete is implicit.
    // If ChatGPT archives = removes from sidebar, we're done.
    // If it's still visible (some UI variants), try delete.
    const stillPresent = findConversationLink(conversationId, adapter) !== null;
    if (stillPresent) {
      return executeAction(conversationId, "delete", adapter.id);
    }
    return true;
  }
  
  const link = findConversationLink(conversationId, adapter);
  let menuTrigger: HTMLButtonElement | null = null;
  if (link) {
    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await wait(300 + Math.random() * 200);
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await wait(300);
    const wrapper = link.closest(adapter.menuScope) || link.parentElement;
    menuTrigger = wrapper?.querySelector(adapter.menuTriggers) as HTMLButtonElement | null;
  } else if (adapter.conversationPath.exec(location.pathname)?.[1] === conversationId) {
    // Virtualized sidebars may unmount an old current row; fall back to the thread-header menu.
    menuTrigger = document.querySelector(
      'header button[aria-haspopup="menu"], [data-testid*="thread-header" i] button[aria-haspopup="menu"], button[aria-label*="More" i]'
    ) as HTMLButtonElement | null;
  }
  if (!menuTrigger) {
    console.error(`[UI Automation] Menu trigger not found for ${conversationId}`);
    return false;
  }

  menuTrigger.click();
  await wait(500 + Math.random() * 300);

  if (action === "archive") {
    const archiveBtn = findMenuItemByText(document.body, adapter.archiveLabels) as HTMLElement;
    
    if (!archiveBtn) return false;
    archiveBtn.click();
    
  } else if (action === "delete") {
    const deleteBtn = findMenuItemByText(document.body, adapter.deleteLabels) as HTMLElement;
    
    if (!deleteBtn) return false;
    deleteBtn.click();
    
    await wait(800 + Math.random() * 300);
    const confirmBtn = findButtonByText(document.body, adapter.confirmDeleteLabels) as HTMLElement;
    if (!confirmBtn) return false;
    
    confirmBtn.click();
  }

  // Verification: wait up to 3 seconds for the link to disappear
  let verified = false;
  for (let i = 0; i < 15; i++) {
    await wait(200);
    const checkLink = findConversationLink(conversationId, adapter);
    const stillCurrent = adapter.conversationPath.exec(location.pathname)?.[1] === conversationId;
    if (link ? !checkLink : !stillCurrent) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    console.warn(`[UI Automation] Verification failed: Link for ${conversationId} is still in DOM after action ${action}.`);
    document.body.click();
  }

  return verified;
}

function findConversationLink(conversationId: string, adapter: ReturnType<typeof getPlatformAdapter>): HTMLAnchorElement | null {
  for (const link of Array.from(document.querySelectorAll(adapter.conversationLink)) as HTMLAnchorElement[]) {
    if (parseConversationId(link.href, adapter) === conversationId) return link;
  }
  return null;
}
