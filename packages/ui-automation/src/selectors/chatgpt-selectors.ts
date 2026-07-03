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
    // We remove :contains because it's invalid for querySelector.
    // Instead we rely on JS helper functions using these attributes or text fallbacks.
    ArchiveAria: '[aria-label*="Archive"], [aria-label*="Archiver"]',
    DeleteAria: '[aria-label*="Delete"], [aria-label*="Supprimer"]',
  },
  Modals: {
    ConfirmDeleteButton: 'button.btn-danger' // Often classes like this exist, otherwise JS text fallback
  }
};

export const TextFallbacks = {
  Archive: ["Archive", "Archiver"],
  Delete: ["Delete", "Supprimer", "Delete chat"],
  ConfirmDelete: ["Delete", "Supprimer", "Confirm", "Confirmer"]
};
