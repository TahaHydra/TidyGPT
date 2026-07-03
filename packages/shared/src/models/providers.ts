export type ProviderHealth = {
  ok: boolean;
  version: string;
  source: "official" | "export" | "dom" | "experimental";
  capabilities: string[];
  warnings: string[];
  lastCheckedAt: string;
};

export type ConversationPage = {
  conversations: { id: string; title: string; updateTime?: string; createTime?: string }[];
  nextCursor?: string;
};

export type ConversationFull = {
  id: string;
  title: string;
  messages: any[];
  metadata: any;
};

export interface ConversationProvider {
  id: string;
  label: string;
  capabilities: {
    listConversations: boolean;
    readConversation: boolean;
    archiveConversation: boolean;
    deleteConversation: boolean;
    getDates: boolean;
    getMessageCounts: boolean;
  };
  healthCheck(): Promise<ProviderHealth>;
  listConversations(cursor?: string): Promise<ConversationPage>;
  readConversation(id: string): Promise<ConversationFull>;
}

export type VerifyResult = {
  status: "success" | "failed" | "unknown";
};

export interface ActionProvider {
  archive(id: string): Promise<import('./job').ActionResult>;
  delete(id: string): Promise<import('./job').ActionResult>;
  verify(id: string, expected: "archived" | "deleted"): Promise<VerifyResult>;
}
