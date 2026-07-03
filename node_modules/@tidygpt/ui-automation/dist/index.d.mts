declare const Selectors: {
    Sidebar: {
        Container: string;
        ChatLink: string;
        DataSidebarItem: string;
        ScrollContainer: string;
    };
    Conversation: {
        MessageRoot: string;
        UserMessage: string;
        AssistantMessage: string;
        StopGeneratingButton: string;
        LoadingSkeleton: string;
    };
    Menu: {
        Trigger: string;
        ArchiveItem: string;
        DeleteItem: string;
    };
    Modals: {
        ConfirmDeleteButton: string;
    };
};

declare function executeAction(conversationId: string, action: "archive" | "delete"): Promise<boolean>;

export { Selectors, executeAction };
