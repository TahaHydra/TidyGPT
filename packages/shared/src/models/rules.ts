export type CustomRule = {
  id: string;
  name: string;
  type: "archive" | "delete" | "keep";
  enabled?: boolean;
  conditions: RuleConditions;
};

export type RuleConditions = {
    olderThanDays?: number;
    newerThanDays?: number;
    maxUserMessages?: number;
    maxTotalMessages?: number;
    minUserMessages?: number;
    minTotalMessages?: number;
    titleContains?: string;
    titleDoesNotContain?: string;
    titleRegex?: string;
    bodyContains?: string;
    bodyDoesNotContain?: string;
    bodyRegex?: string;
    minContentLength?: number;
    maxContentLength?: number;
    noProtectedKeywords?: boolean;
    noFiles?: boolean;
    noCode?: boolean;
    noImages?: boolean;
    noArtifacts?: boolean;
    noProject?: boolean;
};

export type RuleEvaluation = {
  decision: "archive" | "delete" | "keep" | "none";
  matchedRuleIds: string[];
  matchedRuleNames: string[];
};

export type RulesConfig = {
  builtInSettings: import('./settings').CleanerSettings;
  customRules: CustomRule[];
};
