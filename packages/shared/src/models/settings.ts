export type BehaviorSetting = "warn" | "ignore" | "block";

export type CleanerSettings = {
  // Thresholds
  maxUserMessages: number;
  maxTotalMessages: number;
  olderThanDays: number;
  
  // Behaviors
  codeBehavior: BehaviorSetting;
  fileBehavior: BehaviorSetting;
  projectBehavior: BehaviorSetting;
  
  // Exclusions
  protectedKeywords: string[];

  // Live content scan
  contentScanMessageLimit?: number;
  deepScanIdleRounds?: number;
  backupBeforeDelete?: boolean;
  
  // Execution Safety
  minSelectorConfidence: number; // e.g. 0.8
  delayMinMs: number;
  delayMaxMs: number;
  requireReview: boolean;
  deleteConfirmationString: string; // e.g. "CONFIRM"
  
  // Privacy & UI
  logTitleAndUrl: boolean;
  theme: "dark" | "light" | "system";
};

export const defaultSettings: CleanerSettings = {
  maxUserMessages: 1,
  maxTotalMessages: 3,
  olderThanDays: 30,
  codeBehavior: "warn",
  fileBehavior: "block",
  projectBehavior: "block",
  protectedKeywords: [],
  contentScanMessageLimit: 20,
  deepScanIdleRounds: 5,
  backupBeforeDelete: true,
  minSelectorConfidence: 0.8,
  delayMinMs: 1000,
  delayMaxMs: 3000,
  requireReview: true,
  deleteConfirmationString: "CONFIRM",
  logTitleAndUrl: true,
  theme: "dark"
};
