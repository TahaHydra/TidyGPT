import type { ConversationProvider, ProviderHealth, ConversationPage, ConversationFull } from '@tidygpt/shared';
import { getPlatformAdapter, parseConversationId } from '@tidygpt/ui-automation';
import type { PlatformId } from '@tidygpt/shared';

export class DomSidebarProvider implements ConversationProvider {
  id = 'dom_sidebar_provider';
  label = 'Multi-platform Live UI Scanner';
  constructor(private platform?: PlatformId) {}
  capabilities = {
    listConversations: true,
    readConversation: false,
    archiveConversation: false,
    deleteConversation: false,
    getDates: false, // UI only shows generic "Yesterday", "Previous 7 Days"
    getMessageCounts: false,
  };

  async healthCheck(): Promise<ProviderHealth> {
    const adapter = getPlatformAdapter(this.platform);
    const sidebarExists = !!document.querySelector(adapter.sidebar);
    return {
      ok: sidebarExists,
      version: `DOM-based/${adapter.id}`,
      source: 'dom',
      capabilities: ['listConversations'],
      warnings: sidebarExists ? [] : ['Sidebar not found'],
      lastCheckedAt: new Date().toISOString()
    };
  }

  async listConversations(cursor?: string): Promise<ConversationPage> {
    const adapter = getPlatformAdapter(this.platform);
    const links = Array.from(document.querySelectorAll(adapter.conversationLink)) as HTMLAnchorElement[];
    const conversations = links.flatMap(link => {
      const id = parseConversationId(link.href, adapter);
      if (!id) return [];
      return {
        id,
        title: link.textContent || 'Untitled'
      };
    });
    return { conversations };
  }

  async readConversation(id: string): Promise<ConversationFull> {
    throw new Error('Use the extension content-scan pass to read full live conversation context.');
  }
}
