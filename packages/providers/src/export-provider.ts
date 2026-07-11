import type { ConversationProvider, ProviderHealth, ConversationPage, ConversationFull, ConversationCandidate, CleanerSettings } from '@tidygpt/shared';
import { calculateScore, classifyScore } from '@tidygpt/core';

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
  private settings: CleanerSettings;

  constructor(settings: CleanerSettings) {
    this.settings = settings;
  }

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
      title: c.title || 'Untitled',
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
      title: convo.title || 'Untitled',
      messages: Object.values(convo.mapping || {}).map((m: any) => m.message),
      metadata: {}
    };
  }

  async generateCandidates(): Promise<ConversationCandidate[]> {
    const titleCounts = new Map<string, number>();
    
    // First pass: count titles
    for (const c of this.conversations) {
      const title = c.title || 'Untitled';
      titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
    }

    return this.conversations.map(c => {
      const messages = Object.values(c.mapping || {}).map((m: any) => m.message).filter(Boolean);
      let userMessages = 0;
      let assistantMessages = 0;
      let hasCode = false;
      let hasFile = false;
      let contentLength = 0;
      const protectedMatches: string[] = [];
      const title = c.title || 'Untitled';

      messages.forEach(m => {
        if (m.author?.role === 'user') userMessages++;
        if (m.author?.role === 'assistant') assistantMessages++;
        
        if (m.content?.parts) {
          for (const p of m.content.parts) {
            if (typeof p === 'string') {
              contentLength += p.length;
              if (p.includes('```')) hasCode = true;
              
              for (const keyword of this.settings.protectedKeywords) {
                if (p.toLowerCase().includes(keyword.toLowerCase())) {
                  protectedMatches.push(keyword);
                }
              }
            } else if (p.content_type === 'image_asset_pointer' || p.content_type === 'file') {
              hasFile = true;
            }
          }
        }
      });

      const duplicateTitle = (titleCounts.get(title) || 0) > 1 && title !== 'New chat';
      
      const candidate: ConversationCandidate = {
        id: c.conversation_id || c.id,
        providerKey: `chatgpt:${c.conversation_id || c.id}`,
        platform: "chatgpt",
        idHash: `chatgpt:${c.conversation_id || c.id}`,
        title,
        url: `https://chatgpt.com/c/${c.conversation_id || c.id}`,
        source: "export",
        sourceConfidence: 1.0,
        dates: {
          createdAt: c.create_time ? new Date(c.create_time * 1000).toISOString() : undefined,
          updatedAt: c.update_time ? new Date(c.update_time * 1000).toISOString() : undefined,
          ageDays: c.update_time ? Math.floor((Date.now() / 1000 - c.update_time) / 86400) : undefined,
          dateConfidence: c.update_time ? 1.0 : 0.0,
        },
        counts: {
          userMessages,
          assistantMessages,
          totalMessages: userMessages + assistantMessages,
          countConfidence: 1.0,
        },
        signals: {
          genericTitle: title === 'New chat',
          duplicateTitle,
          hasCode,
          hasFile,
          hasImage: "unknown",
          hasArtifact: "unknown",
          isProject: "unknown",
          isCurrentChat: false,
          protectedKeywordMatches: Array.from(new Set(protectedMatches)),
        },
        score: {
          total: 0,
          shortConversation: 0,
          oldAge: 0,
          genericTitle: 0,
          duplicateTitle: 0,
          noFiles: 0,
          noCode: 0,
          noProject: 0,
          noProtectedKeyword: 0,
          lowContentLength: 0,
          confidence: 1.0
        },
        riskFlags: protectedMatches.length > 0 ? ["protected_keyword"] : [],
        recommendation: "ignore",
        selectedAction: "none",
        status: "discovered"
      };
      
      candidate.contentLength = contentLength;
      candidate.backupAvailable = false;

      const score = calculateScore(candidate, this.settings);
      candidate.score = score;
      candidate.recommendation = classifyScore(score, this.settings, candidate.riskFlags);
      
      return candidate;
    });
  }
}
