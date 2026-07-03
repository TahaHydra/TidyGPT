import type { ConversationProvider, ProviderHealth, ConversationPage, ConversationFull } from '@tidygpt/shared';
import { Selectors } from '@tidygpt/ui-automation';

export class DomSidebarProvider implements ConversationProvider {
  id = 'dom_sidebar_provider';
  label = 'Live UI Scanner Engine';
  capabilities = {
    listConversations: true,
    readConversation: false,
    archiveConversation: false,
    deleteConversation: false,
    getDates: false, // UI only shows generic "Yesterday", "Previous 7 Days"
    getMessageCounts: false,
  };

  async healthCheck(): Promise<ProviderHealth> {
    const sidebarExists = !!document.querySelector(Selectors.Sidebar.Container);
    return {
      ok: sidebarExists,
      version: 'DOM-based',
      source: 'dom',
      capabilities: ['listConversations'],
      warnings: sidebarExists ? [] : ['Sidebar not found'],
      lastCheckedAt: new Date().toISOString()
    };
  }

  async listConversations(cursor?: string): Promise<ConversationPage> {
    const links = Array.from(document.querySelectorAll(Selectors.Sidebar.ChatLink)) as HTMLAnchorElement[];
    const conversations = links.map(link => {
      const url = new URL(link.href);
      const id = url.pathname.replace('/c/', '');
      return {
        id,
        title: link.textContent || 'Untitled'
      };
    });
    return { conversations };
  }

  async readConversation(id: string): Promise<ConversationFull> {
    throw new Error('DomSidebarProvider cannot read full conversation context.');
  }
}
