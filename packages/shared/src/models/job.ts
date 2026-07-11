import { ConversationCandidate } from "./conversation";

import { CleanerSettings } from "./settings";

export type JobState =
  | "idle"
  | "discovering"
  | "scanning"
  | "classifying"
  | "review_ready"
  | "executing"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed"
  | "blocked_adapter_changed";

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
  jobId: string;
  source: "export" | "live_ui" | "hybrid" | "adapter";
  mode: "dry_run" | "archive" | "delete" | "archive_then_delete";
  status: JobState;
  createdAt: string;
  updatedAt: string;
  progress: number;
  currentItemId?: string;
  settingsSnapshot: CleanerSettings;
  candidates: ConversationCandidate[];
  actionPlan: ActionPlan;
  results: ActionResult[];
  errors: string[];
  backupCreatedAt?: string;
};

export type LogEntry = {
  id: string;
  jobId: string;
  timestamp: string;
  source: "export" | "live_ui" | "hybrid" | "adapter";
  action: "archive" | "delete" | "archive_then_delete" | "dry_run";
  status: "success" | "failed" | "skipped";
  details?: any;
};

