import type {
  ConversationCandidate, RuleConditions, RuleEvaluation, RulesConfig,
} from '@tidygpt/shared';

export function evaluateRulesDetailed(
  candidate: Partial<ConversationCandidate>,
  config: RulesConfig,
  bodyText = '',
): RuleEvaluation {
  const matches = config.customRules.filter(rule =>
    rule.enabled !== false && hasConditions(rule.conditions) && matchesRule(candidate, rule.conditions, bodyText)
  );

  // Protection always wins, regardless of rule order. Delete then wins over
  // archive so the result is stable when several user-created rules match.
  const decision = matches.some(rule => rule.type === 'keep') ? 'keep'
    : matches.some(rule => rule.type === 'delete') ? 'delete'
      : matches.some(rule => rule.type === 'archive') ? 'archive' : 'none';

  return {
    decision,
    matchedRuleIds: matches.map(rule => rule.id),
    matchedRuleNames: matches.map(rule => rule.name),
  };
}

export function evaluateRules(
  candidate: Partial<ConversationCandidate>,
  config: RulesConfig,
  bodyText = '',
): RuleEvaluation['decision'] {
  return evaluateRulesDetailed(candidate, config, bodyText).decision;
}

function hasConditions(conditions: RuleConditions): boolean {
  return Object.values(conditions).some(value => value !== undefined && value !== false && value !== '');
}

function matchesRule(candidate: Partial<ConversationCandidate>, conditions: RuleConditions, bodyText: string): boolean {
  if (conditions.olderThanDays != null && (candidate.dates?.ageDays ?? -1) < conditions.olderThanDays) return false;
  if (conditions.newerThanDays != null && (candidate.dates?.ageDays ?? Number.MAX_SAFE_INTEGER) > conditions.newerThanDays) return false;
  if (conditions.maxUserMessages != null && (candidate.counts?.userMessages ?? Number.MAX_SAFE_INTEGER) > conditions.maxUserMessages) return false;
  if (conditions.maxTotalMessages != null && (candidate.counts?.totalMessages ?? Number.MAX_SAFE_INTEGER) > conditions.maxTotalMessages) return false;
  if (conditions.minUserMessages != null && (candidate.counts?.userMessages ?? -1) < conditions.minUserMessages) return false;
  if (conditions.minTotalMessages != null && (candidate.counts?.totalMessages ?? -1) < conditions.minTotalMessages) return false;

  const title = (candidate.title || '').toLocaleLowerCase();
  if (conditions.titleContains && !title.includes(conditions.titleContains.toLocaleLowerCase())) return false;
  if (conditions.titleDoesNotContain && title.includes(conditions.titleDoesNotContain.toLocaleLowerCase())) return false;
  if (conditions.titleRegex) {
    const regex = safeRegex(conditions.titleRegex);
    if (!regex || !regex.test(candidate.title || '')) return false;
  }

  const body = bodyText.toLocaleLowerCase();
  if (conditions.bodyContains && !body.includes(conditions.bodyContains.toLocaleLowerCase())) return false;
  if (conditions.bodyDoesNotContain && body.includes(conditions.bodyDoesNotContain.toLocaleLowerCase())) return false;
  if (conditions.bodyRegex) {
    const regex = safeRegex(conditions.bodyRegex);
    if (!regex || !regex.test(bodyText)) return false;
  }
  if (conditions.minContentLength != null && (candidate.contentLength ?? 0) < conditions.minContentLength) return false;
  if (conditions.maxContentLength != null && (candidate.contentLength ?? Number.MAX_SAFE_INTEGER) > conditions.maxContentLength) return false;
  if (conditions.noProtectedKeywords && (candidate.signals?.protectedKeywordMatches?.length ?? 0) > 0) return false;
  if (conditions.noFiles && candidate.signals?.hasFile !== false) return false;
  if (conditions.noCode && candidate.signals?.hasCode !== false) return false;
  if (conditions.noImages && candidate.signals?.hasImage !== false) return false;
  if (conditions.noArtifacts && candidate.signals?.hasArtifact !== false) return false;
  if (conditions.noProject && candidate.signals?.isProject !== false) return false;
  return true;
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}
