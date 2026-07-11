import type { ConversationCandidate, RulesConfig } from '@tidygpt/shared';

export function evaluateRules(candidate: Partial<ConversationCandidate>, config: RulesConfig, bodyText = ""): "archive" | "delete" | "keep" | "none" {
  // Check custom rules first
  for (const rule of config.customRules) {
    if (matchesRule(candidate, rule.conditions, bodyText)) {
      return rule.type;
    }
  }

  // Fallback logic could be handled here or by the score engine
  return "none";
}

function matchesRule(candidate: Partial<ConversationCandidate>, conditions: any, bodyText: string): boolean {
  if (conditions.olderThanDays && (candidate.dates?.ageDays ?? 0) < conditions.olderThanDays) {
    return false;
  }
  if (conditions.newerThanDays && (candidate.dates?.ageDays ?? 0) > conditions.newerThanDays) {
    return false;
  }
  if (conditions.maxUserMessages && (candidate.counts?.userMessages ?? 99) > conditions.maxUserMessages) {
    return false;
  }
  if (conditions.maxTotalMessages && (candidate.counts?.totalMessages ?? 99) > conditions.maxTotalMessages) {
    return false;
  }
  if (conditions.titleContains && !(candidate.title || "").includes(conditions.titleContains)) {
    return false;
  }
  if (conditions.titleDoesNotContain && (candidate.title || "").includes(conditions.titleDoesNotContain)) {
    return false;
  }
  if (conditions.titleRegex) {
    const regex = safeRegex(conditions.titleRegex);
    if (!regex) return false;
    if (!regex.test(candidate.title || "")) {
      return false;
    }
  }
  const body = bodyText.toLocaleLowerCase();
  if (conditions.bodyContains && !body.includes(String(conditions.bodyContains).toLocaleLowerCase())) return false;
  if (conditions.bodyDoesNotContain && body.includes(String(conditions.bodyDoesNotContain).toLocaleLowerCase())) return false;
  if (conditions.bodyRegex) {
    const regex = safeRegex(conditions.bodyRegex);
    if (!regex || !regex.test(bodyText)) return false;
  }
  if (conditions.minContentLength != null && (candidate.contentLength ?? 0) < conditions.minContentLength) return false;
  if (conditions.maxContentLength != null && (candidate.contentLength ?? Number.MAX_SAFE_INTEGER) > conditions.maxContentLength) return false;
  if (conditions.noProtectedKeywords && (candidate.signals?.protectedKeywordMatches?.length ?? 0) > 0) {
    return false;
  }
  if (conditions.noFiles && candidate.signals?.hasFile) {
    return false;
  }
  if (conditions.noCode && candidate.signals?.hasCode) {
    return false;
  }
  if (conditions.noProject && candidate.signals?.isProject) {
    return false;
  }

  return true;
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}
