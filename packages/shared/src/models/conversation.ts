export type CleanupClass =
  | "strong_archive_candidate"
  | "archive_candidate"
  | "manual_review"
  | "protected"
  | "uncertain"
  | "delete_candidate";

export type CandidateScore = {
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

export type ConversationCandidate = {
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

  recommendation:
    | "ignore"
    | "archive_candidate"
    | "delete_candidate"
    | "manual_review"
    | "protected"
    | "uncertain";

  selectedAction: "none" | "archive" | "delete" | "archive_then_delete";

  status:
    | "discovered"
    | "scanned"
    | "queued"
    | "archived"
    | "deleted"
    | "skipped"
    | "failed";
};
