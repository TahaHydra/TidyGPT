import { Selectors, TextFallbacks } from '../selectors/chatgpt-selectors';
import { findMenuItemByText, findButtonByText } from '../selectors/helpers';

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeAction(conversationId: string, action: "archive" | "delete" | "archive_then_delete"): Promise<boolean> {
  console.log(`[UI Automation] Executing ${action} on ${conversationId}`);

  if (action === "archive_then_delete") {
    const archiveOk = await executeAction(conversationId, "archive");
    if (!archiveOk) {
      console.error(`[UI Automation] Archive step failed for ${conversationId}, aborting delete.`);
      return false;
    }
    // After archive the link should be gone; delete is implicit.
    // If ChatGPT archives = removes from sidebar, we're done.
    // If it's still visible (some UI variants), try delete.
    const stillPresent = !!document.querySelector(`a[href*="/c/${conversationId}"]`);
    if (stillPresent) {
      return executeAction(conversationId, "delete");
    }
    return true;
  }
  
  const link = document.querySelector(`a[href*="/c/${conversationId}"]`) as HTMLAnchorElement;
  if (!link) {
    console.error(`[UI Automation] Link not found for ${conversationId}`);
    return false;
  }
  
  link.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await wait(300 + Math.random() * 200);
  
  // Dispatch hover
  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await wait(300);

  const wrapper = link.closest(Selectors.Sidebar.DataSidebarItem) || link.parentElement;
  if (!wrapper) return false;

  const menuTrigger = wrapper.querySelector(Selectors.Menu.Trigger) as HTMLButtonElement;
  if (!menuTrigger) {
    console.error(`[UI Automation] Menu trigger not found for ${conversationId}`);
    return false;
  }

  menuTrigger.click();
  await wait(500 + Math.random() * 300);

  if (action === "archive") {
    let archiveBtn = document.querySelector(Selectors.Menu.ArchiveAria) as HTMLElement;
    if (!archiveBtn) archiveBtn = findMenuItemByText(document.body, TextFallbacks.Archive) as HTMLElement;
    
    if (!archiveBtn) return false;
    archiveBtn.click();
    
  } else if (action === "delete") {
    let deleteBtn = document.querySelector(Selectors.Menu.DeleteAria) as HTMLElement;
    if (!deleteBtn) deleteBtn = findMenuItemByText(document.body, TextFallbacks.Delete) as HTMLElement;
    
    if (!deleteBtn) return false;
    deleteBtn.click();
    
    await wait(800 + Math.random() * 300);
    let confirmBtn = document.querySelector(Selectors.Modals.ConfirmDeleteButton) as HTMLElement;
    if (!confirmBtn) confirmBtn = findButtonByText(document.body, TextFallbacks.ConfirmDelete) as HTMLElement;
    if (!confirmBtn) return false;
    
    confirmBtn.click();
  }

  // Verification: wait up to 3 seconds for the link to disappear
  let verified = false;
  for (let i = 0; i < 15; i++) {
    await wait(200);
    const checkLink = document.querySelector(`a[href*="/c/${conversationId}"]`);
    if (!checkLink) {
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
