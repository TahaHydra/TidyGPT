export type BehaviorSetting = "warn" | "ignore" | "block";

export type CleanerSettings = {
  // Thresholds
  maxUserMessages: number;
  maxTotalMessages: number;
  olderThanDays: number;
  
  // Behaviors
  codeBehavior: BehaviorSetting;
  fileBehavior: BehaviorSetting;
  imageBehavior: BehaviorSetting;
  projectBehavior: BehaviorSetting;
  
  // Exclusions
  protectedKeywords: string[];

  // Live content scan
  contentScanMessageLimit?: number;
  contentScanDelayMinMs?: number;
  contentScanDelayMaxMs?: number;
  contentScanBatchSize?: number;
  contentScanBatchCooldownMs?: number;
  contentScanMaxRetries?: number;
  contentScanRetryBaseMs?: number;
  deepScanIdleRounds?: number;
  deepScanStepDelayMs?: number;
  /** Maximum viewport-sized sidebar scroll steps. Zero means unlimited. */
  deepScanMaxScrollPages?: number;
  /** Zero means unlimited. */
  deepScanMaxConversations?: number;
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
  imageBehavior: "warn",
  projectBehavior: "block",
  protectedKeywords: [],
  contentScanMessageLimit: 20,
  contentScanDelayMinMs: 4000,
  contentScanDelayMaxMs: 7000,
  contentScanBatchSize: 20,
  contentScanBatchCooldownMs: 30000,
  contentScanMaxRetries: 3,
  contentScanRetryBaseMs: 30000,
  deepScanIdleRounds: 10,
  deepScanStepDelayMs: 650,
  deepScanMaxScrollPages: 5,
  deepScanMaxConversations: 0,
  backupBeforeDelete: true,
  minSelectorConfidence: 0.8,
  delayMinMs: 1000,
  delayMaxMs: 3000,
  requireReview: true,
  deleteConfirmationString: "CONFIRM",
  logTitleAndUrl: true,
  theme: "dark"
};
