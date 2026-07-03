export type CustomRule = {
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

export type RulesConfig = {
  builtInSettings: import('./settings').CleanerSettings;
  customRules: CustomRule[];
};
