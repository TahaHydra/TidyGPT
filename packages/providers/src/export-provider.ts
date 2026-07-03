import type { ConversationProvider, ProviderHealth, ConversationPage, ConversationFull } from '@tidygpt/shared';

export class ExportProvider implements ConversationProvider {
  id = 'export_provider';
  label = 'Export Analyzer Engine';
  capabilities = {
    listConversations: true,
    readConversation: true,
    archiveConversation: false,
    deleteConversation: false,
    getDates: true,
    getMessageCounts: true,
  };

  private conversations: any[] = [];

  async loadFromJSON(data: any[]) {
    this.conversations = data;
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      ok: true,
      version: '1.0',
      source: 'export',
      capabilities: ['listConversations', 'readConversation'],
      warnings: [],
      lastCheckedAt: new Date().toISOString()
    };
  }

  async listConversations(cursor?: string): Promise<ConversationPage> {
    const list = this.conversations.map(c => ({
      id: c.conversation_id || c.id,
      title: c.title,
      createTime: c.create_time,
      updateTime: c.update_time
    }));
    return { conversations: list };
  }

  async readConversation(id: string): Promise<ConversationFull> {
    const convo = this.conversations.find(c => c.conversation_id === id || c.id === id);
    if (!convo) throw new Error('Not found');
    return {
      id: convo.conversation_id || convo.id,
      title: convo.title,
      messages: Object.values(convo.mapping || {}).map((m: any) => m.message),
      metadata: {}
    };
  }
}
