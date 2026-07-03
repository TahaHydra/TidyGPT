type CleanupClass = "strong_archive_candidate" | "archive_candidate" | "manual_review" | "protected" | "uncertain" | "delete_candidate";
type RiskFlag = "protected_keyword" | "current_chat" | "low_confidence_selector" | "is_project" | "has_files" | "has_code" | "unknown_state";
type CandidateScore = {
    total: number;
    shortConversation: number;
    oldAge: number;
    genericTitle: number;
    duplicateTitle: number;
    noFiles: number;
    noCode: number;
    noProject: number;
    noProtectedKeyword: number;
    lowContentLength: number;
    confidence: number;
};
type ConversationCandidate = {
    id: string;
    idHash: string;
    title?: string;
    titleHash?: string;
    url?: string;
    source: "export" | "live_ui" | "hybrid" | "adapter";
    sourceConfidence: number;
    dates: {
        createdAt?: string;
        updatedAt?: string;
        ageDays?: number;
        dateConfidence: number;
    };
    counts: {
        userMessages?: number;
        assistantMessages?: number;
        totalMessages?: number;
        countConfidence: number;
    };
    signals: {
        genericTitle: boolean;
        duplicateTitle: boolean;
        hasCode: boolean | "unknown";
        hasFile: boolean | "unknown";
        hasImage: boolean | "unknown";
        hasArtifact: boolean | "unknown";
        isProject: boolean | "unknown";
        isCurrentChat: boolean;
        protectedKeywordMatches: string[];
    };
    score: CandidateScore;
    riskFlags: RiskFlag[];
    recommendation: CleanupClass | "ignore";
    selectedAction: "none" | "archive" | "delete" | "archive_then_delete";
    status: "discovered" | "scanned" | "queued" | "archived" | "deleted" | "skipped" | "failed";
};

type JobState = "idle" | "source_selected" | "discovering" | "importing" | "scanning" | "classifying" | "review_ready" | "action_plan_ready" | "executing" | "paused" | "cancelled" | "completed" | "failed" | "blocked_adapter_changed";
type CleanerSettings = {
    maxUserMessages: number;
    maxTotalMessages: number;
    olderThanDays: number;
    skipCurrentChat: boolean;
    skipProjects: boolean;
    skipFiles: boolean;
    skipArtifacts: boolean;
    codeHandling: "warn" | "ignore" | "block";
    protectedKeywords: string[];
};
type ActionPlan = {
    archiveCount: number;
    deleteCount: number;
    blockedCount: number;
    uncertainCount: number;
    estimatedTimeMs: number;
};
type ActionResult = {
    id: string;
    action: "archive" | "delete" | "archive_then_delete";
    status: "success" | "failed" | "skipped";
    error?: string;
    timestamp: string;
};
type CleanupJob = {
    id: string;
    createdAt: string;
    source: "export" | "live_ui" | "hybrid" | "adapter";
    actionMode: "dry_run" | "archive" | "delete" | "archive_then_delete";
    status: JobState;
    settingsSnapshot: CleanerSettings;
    candidates: ConversationCandidate[];
    actionPlan: ActionPlan;
    results: ActionResult[];
};
type LogEntry = {
    id: string;
    jobId: string;
    timestamp: string;
    source: "export" | "live_ui" | "hybrid" | "adapter";
    action: "archive" | "delete" | "archive_then_delete" | "dry_run";
    status: "success" | "failed" | "skipped";
    details?: any;
};

type CustomRule = {
    id: string;
    name: string;
    type: "archive" | "delete" | "keep";
    conditions: {
        olderThanDays?: number;
        newerThanDays?: number;
        maxUserMessages?: number;
        maxTotalMessages?: number;
        titleContains?: string;
        titleDoesNotContain?: string;
        titleRegex?: string;
        noProtectedKeywords?: boolean;
        noFiles?: boolean;
        noCode?: boolean;
        noProject?: boolean;
    };
};
type RulesConfig = {
    builtInSettings: CleanerSettings;
    customRules: CustomRule[];
};

type ProviderHealth = {
    ok: boolean;
    version: string;
    source: "official" | "export" | "dom" | "experimental";
    capabilities: string[];
    warnings: string[];
    lastCheckedAt: string;
};
type ConversationPage = {
    conversations: {
        id: string;
        title: string;
        updateTime?: string;
        createTime?: string;
    }[];
    nextCursor?: string;
};
type ConversationFull = {
    id: string;
    title: string;
    messages: any[];
    metadata: any;
};
interface ConversationProvider {
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
type VerifyResult = {
    status: "success" | "failed" | "unknown";
};
interface ActionProvider {
    archive(id: string): Promise<ActionResult>;
    delete(id: string): Promise<ActionResult>;
    verify(id: string, expected: "archived" | "deleted"): Promise<VerifyResult>;
}

export type { ActionPlan, ActionProvider, ActionResult, CandidateScore, CleanerSettings, CleanupClass, CleanupJob, ConversationCandidate, ConversationFull, ConversationPage, ConversationProvider, CustomRule, JobState, LogEntry, ProviderHealth, RiskFlag, RulesConfig, VerifyResult };
