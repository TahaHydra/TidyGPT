import { Selectors } from '../selectors/chatgpt-selectors';

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeAction(conversationId: string, action: "archive" | "delete"): Promise<boolean> {
  console.log(`[UI Automation] Executing ${action} on ${conversationId}`);
  
  // 1. Locate target link
  const link = document.querySelector(`a[href*="/c/${conversationId}"]`) as HTMLAnchorElement;
  if (!link) {
    console.error(`[UI Automation] Link not found for ${conversationId}`);
    return false;
  }
  
  // scroll into view
  link.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await wait(300 + Math.random() * 200);
  
  // In ChatGPT, the menu trigger is usually a descendant button inside the active link or hovered item.
  // We may need to dispatch a hover event or simply find the options button next to the link.
  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await wait(300);

  // find the closest container that holds the options menu (often a wrapper around the link)
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
    const archiveBtn = document.querySelector(Selectors.Menu.ArchiveItem) as HTMLElement;
    if (!archiveBtn) return false;
    archiveBtn.click();
  } else if (action === "delete") {
    const deleteBtn = document.querySelector(Selectors.Menu.DeleteItem) as HTMLElement;
    if (!deleteBtn) return false;
    deleteBtn.click();
    
    await wait(800 + Math.random() * 300);
    const confirmBtn = document.querySelector(Selectors.Modals.ConfirmDeleteButton) as HTMLElement;
    if (!confirmBtn) return false;
    confirmBtn.click();
  }

  // wait for UI update
  await wait(1000 + Math.random() * 500);
  return true;
}
