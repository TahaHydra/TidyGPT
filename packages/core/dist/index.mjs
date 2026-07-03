// src/classifier/score-engine.ts
function calculateScore(candidate, settings) {
  let score = 0;
  const shortConversation = (candidate.counts?.userMessages ?? 99) <= 1 ? 30 : (candidate.counts?.totalMessages ?? 99) <= 3 ? 20 : 0;
  score += shortConversation;
  const oldAge = (candidate.dates?.ageDays ?? 0) > 30 ? 15 : 0;
  score += oldAge;
  const genericTitle = candidate.signals?.genericTitle ? 10 : 0;
  score += genericTitle;
  const duplicateTitle = candidate.signals?.duplicateTitle ? 10 : 0;
  score += duplicateTitle;
  const noFiles = candidate.signals?.hasFile === false ? 10 : 0;
  score += noFiles;
  const noCode = candidate.signals?.hasCode === false ? 10 : 0;
  score += noCode;
  const noProject = candidate.signals?.isProject === false ? 10 : 0;
  score += noProject;
  const noProtectedKeyword = candidate.signals?.protectedKeywordMatches?.length === 0 ? 0 : -100;
  score += noProtectedKeyword;
  if (candidate.signals?.isProject && !settings.skipProjects) {
    score -= 80;
  }
  if (candidate.signals?.hasFile && !settings.skipFiles) {
    score -= 60;
  }
  if (candidate.signals?.hasCode && settings.codeHandling !== "ignore") {
    score -= 40;
  }
  const confidenceScore = candidate.sourceConfidence || 0;
  if (confidenceScore < 0.5) {
    score -= 100;
  }
  const lowContentLength = 0;
  return {
    total: score,
    shortConversation,
    oldAge,
    genericTitle,
    duplicateTitle,
    noFiles,
    noCode,
    noProject,
    noProtectedKeyword,
    lowContentLength,
    confidence: confidenceScore
  };
}
function classifyScore(score, ruleOverride) {
  if (score.confidence < 0.5) return "uncertain";
  if (score.noProtectedKeyword === -100) return "protected";
  if (ruleOverride === "keep") return "protected";
  if (ruleOverride === "delete") return "delete_candidate";
  if (ruleOverride === "archive") return "strong_archive_candidate";
  if (score.total >= 90) return "strong_archive_candidate";
  if (score.total >= 70) return "archive_candidate";
  if (score.total >= 40) return "manual_review";
  return "ignore";
}

// src/classifier/rule-engine.ts
function evaluateRules(candidate, config) {
  for (const rule of config.customRules) {
    if (matchesRule(candidate, rule.conditions)) {
      return rule.type;
    }
  }
  return "none";
}
function matchesRule(candidate, conditions) {
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
    const regex = new RegExp(conditions.titleRegex, "i");
    if (!regex.test(candidate.title || "")) {
      return false;
    }
  }
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
export {
  calculateScore,
  classifyScore,
  evaluateRules
};
