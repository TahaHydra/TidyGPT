export const Selectors = {
  Sidebar: {
    Container: 'nav[aria-label*="chat"], nav[aria-label*="Historique"]',
    ChatLink: 'a[href^="/c/"]',
    DataSidebarItem: '[data-sidebar-item="true"]',
    ScrollContainer: '.overflow-y-auto'
  },
  Conversation: {
    MessageRoot: '[data-testid^="conversation-turn-"]',
    UserMessage: '[data-message-author-role="user"]',
    AssistantMessage: '[data-message-author-role="assistant"]',
    StopGeneratingButton: 'button[aria-label="Stop generating"]',
    LoadingSkeleton: '.animate-pulse'
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
