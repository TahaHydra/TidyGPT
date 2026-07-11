import type { PlatformId } from "@tidygpt/shared";

export type PlatformAdapter = {
  id: PlatformId;
  label: string;
  hosts: string[];
  conversationPath: RegExp;
  conversationLink: string;
  sidebar: string;
  scrollContainers: string[];
  messageRoots: string;
  userMessages: string;
  assistantMessages: string;
  loading: string;
  generating: string;
  menuTriggers: string;
  menuScope: string;
  archiveLabels: string[];
  deleteLabels: string[];
  confirmDeleteLabels: string[];
  supportsArchive: boolean;
};

export const PlatformAdapters: Record<PlatformId, PlatformAdapter> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    hosts: ["chatgpt.com", "chat.openai.com"],
    conversationPath: /^\/c\/([^/?#]+)/,
    conversationLink: 'a[href^="/c/"]',
    sidebar: 'nav[aria-label*="chat" i], nav[aria-label*="histor" i]',
    scrollContainers: ['nav[aria-label*="chat history" i]', '.overflow-y-auto'],
    messageRoots: '[data-testid^="conversation-turn-"]',
    userMessages: '[data-message-author-role="user"]',
    assistantMessages: '[data-message-author-role="assistant"]',
    loading: '.animate-pulse',
    generating: 'button[aria-label*="Stop generating" i]',
    menuTriggers: 'button[aria-haspopup="menu"], [role="button"][aria-haspopup="menu"]',
    menuScope: '[data-sidebar-item="true"]',
    archiveLabels: ["Archive", "Archiver"],
    deleteLabels: ["Delete", "Delete chat", "Supprimer"],
    confirmDeleteLabels: ["Delete", "Confirm", "Supprimer", "Confirmer"],
    supportsArchive: true,
  },
  claude: {
    id: "claude",
    label: "Claude",
    hosts: ["claude.ai"],
    conversationPath: /^\/chat\/([^/?#]+)/,
    conversationLink: 'a[href^="/chat/"]',
    sidebar: 'nav, aside, [data-testid*="sidebar" i]',
    scrollContainers: ['nav [class*="overflow-y-auto"]', 'aside [class*="overflow-y-auto"]', '[data-testid*="sidebar" i]'],
    messageRoots: '[data-testid="user-message"], [data-testid="assistant-message"], .font-user-message, .font-claude-message',
    userMessages: '[data-testid="user-message"], .font-user-message',
    assistantMessages: '[data-testid="assistant-message"], .font-claude-message',
    loading: '[data-testid*="loading" i], [aria-busy="true"]',
    generating: 'button[aria-label*="Stop" i], button[data-testid*="stop" i]',
    menuTriggers: 'button[aria-haspopup="menu"], button[aria-label*="menu" i], button[aria-label*="options" i]',
    menuScope: 'li, [role="listitem"], [data-testid*="conversation" i]',
    archiveLabels: [],
    deleteLabels: ["Delete", "Delete chat", "Supprimer"],
    confirmDeleteLabels: ["Delete", "Confirm", "Supprimer", "Confirmer"],
    supportsArchive: false,
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    hosts: ["gemini.google.com"],
    conversationPath: /^\/app\/([^/?#]+)/,
    conversationLink: 'a[href^="/app/"]',
    sidebar: 'bard-sidenav, nav, mat-sidenav',
    scrollContainers: ['bard-sidenav .mat-drawer-inner-container', 'mat-sidenav .mat-drawer-inner-container', '[class*="conversation-list"]'],
    messageRoots: 'user-query, model-response, [data-test-id*="conversation-turn" i]',
    userMessages: 'user-query, .user-query-container, [data-test-id*="user-query" i]',
    assistantMessages: 'model-response, .model-response-text, [data-test-id*="model-response" i]',
    loading: 'mat-progress-spinner, [aria-busy="true"]',
    generating: 'button[aria-label*="Stop" i], button[data-test-id*="stop" i]',
    menuTriggers: 'button[aria-haspopup="menu"], button[aria-label*="More" i], button[aria-label*="options" i], [data-test-id*="actions-menu" i]',
    menuScope: 'li, [role="listitem"], .conversation, [class*="conversation-container"]',
    archiveLabels: [],
    deleteLabels: ["Delete", "Delete chat", "Supprimer"],
    confirmDeleteLabels: ["Delete", "Confirm", "Supprimer", "Confirmer"],
    supportsArchive: false,
  },
};

export function detectPlatform(hostname = location.hostname): PlatformId | null {
  const host = hostname.toLowerCase();
  return (Object.values(PlatformAdapters).find(adapter => adapter.hosts.some(item => host === item || host.endsWith(`.${item}`)))?.id ?? null);
}

export function getPlatformAdapter(platform?: PlatformId | null): PlatformAdapter {
  const id = platform ?? detectPlatform();
  if (!id) throw new Error(`Unsupported AI chat host: ${location.hostname}`);
  return PlatformAdapters[id];
}

export function parseConversationId(href: string, adapter: PlatformAdapter): string | null {
  const path = new URL(href, location.origin).pathname;
  return adapter.conversationPath.exec(path)?.[1] ?? null;
}
