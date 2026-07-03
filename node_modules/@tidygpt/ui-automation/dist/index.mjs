// src/selectors/chatgpt-selectors.ts
var Selectors = {
  Sidebar: {
    Container: 'nav[aria-label*="chat"], nav[aria-label*="Historique"]',
    ChatLink: 'a[href^="/c/"]',
    DataSidebarItem: '[data-sidebar-item="true"]',
    ScrollContainer: ".overflow-y-auto"
  },
  Conversation: {
    MessageRoot: '[data-testid^="conversation-turn-"]',
    UserMessage: '[data-message-author-role="user"]',
    AssistantMessage: '[data-message-author-role="assistant"]',
    StopGeneratingButton: 'button[aria-label="Stop generating"]',
    LoadingSkeleton: ".animate-pulse"
  },
  Menu: {
    Trigger: 'button[aria-haspopup="menu"]',
    ArchiveItem: 'menuitem[aria-label*="Archive"], div:contains("Archive")',
    DeleteItem: 'menuitem[aria-label*="Delete"], div:contains("Delete")'
  },
  Modals: {
    ConfirmDeleteButton: 'button.btn-danger, button:contains("Delete")'
  }
};

// src/actions/runner.ts
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function executeAction(conversationId, action) {
  console.log(`[UI Automation] Executing ${action} on ${conversationId}`);
  const link = document.querySelector(`a[href*="/c/${conversationId}"]`);
  if (!link) {
    console.error(`[UI Automation] Link not found for ${conversationId}`);
    return false;
  }
  link.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(300 + Math.random() * 200);
  link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  await wait(300);
  const wrapper = link.closest(Selectors.Sidebar.DataSidebarItem) || link.parentElement;
  if (!wrapper) return false;
  const menuTrigger = wrapper.querySelector(Selectors.Menu.Trigger);
  if (!menuTrigger) {
    console.error(`[UI Automation] Menu trigger not found for ${conversationId}`);
    return false;
  }
  menuTrigger.click();
  await wait(500 + Math.random() * 300);
  if (action === "archive") {
    const archiveBtn = document.querySelector(Selectors.Menu.ArchiveItem);
    if (!archiveBtn) return false;
    archiveBtn.click();
  } else if (action === "delete") {
    const deleteBtn = document.querySelector(Selectors.Menu.DeleteItem);
    if (!deleteBtn) return false;
    deleteBtn.click();
    await wait(800 + Math.random() * 300);
    const confirmBtn = document.querySelector(Selectors.Modals.ConfirmDeleteButton);
    if (!confirmBtn) return false;
    confirmBtn.click();
  }
  await wait(1e3 + Math.random() * 500);
  return true;
}
export {
  Selectors,
  executeAction
};
