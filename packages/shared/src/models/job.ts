import { ConversationCandidate } from "./conversation";

export type JobState =
  | "idle"
  | "source_selected"
  | "discovering"
  | "importing"
  | "scanning"
  | "classifying"
  | "review_ready"
  | "action_plan_ready"
  | "executing"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed"
  | "blocked_adapter_changed";

export type CleanerSettings = {
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

export type ActionPlan = {
  archiveCount: number;
  deleteCount: number;
  blockedCount: number;
  uncertainCount: number;
  estimatedTimeMs: number;
};

export type ActionResult = {
  id: string;
  action: "archive" | "delete" | "archive_then_delete";
  status: "success" | "failed" | "skipped";
  error?: string;
  timestamp: string;
};

export type CleanupJob = {
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
