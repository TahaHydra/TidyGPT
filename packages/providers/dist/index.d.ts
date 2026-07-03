import { ConversationProvider, ProviderHealth, ConversationPage, ConversationFull, ConversationCandidate, ActionProvider, VerifyResult } from '@tidygpt/shared';

declare class ExportProvider implements ConversationProvider {
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
    private conversations;
    loadFromJSON(data: any[]): Promise<void>;
    healthCheck(): Promise<ProviderHealth>;
    listConversations(cursor?: string): Promise<ConversationPage>;
    readConversation(id: string): Promise<ConversationFull>;
    generateCandidates(): Promise<ConversationCandidate[]>;
}

declare class DomSidebarProvider implements ConversationProvider {
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

declare class DomActionProvider implements ActionProvider {
    archive(id: string): Promise<{
        id: string;
        action: "archive";
        status: "failed" | "success";
        timestamp: string;
    }>;
    delete(id: string): Promise<{
        id: string;
        action: "delete";
        status: "failed" | "success";
        timestamp: string;
    }>;
    verify(id: string, expected: "archived" | "deleted"): Promise<VerifyResult>;
}

export { DomActionProvider, DomSidebarProvider, ExportProvider };
