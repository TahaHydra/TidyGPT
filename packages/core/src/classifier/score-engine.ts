import type { CandidateScore, ConversationCandidate, CleanerSettings } from '@tidygpt/shared';

export function calculateScore(candidate: Partial<ConversationCandidate>, settings: CleanerSettings): CandidateScore {
  let score = 0;
  
  const shortConversation = (candidate.counts?.userMessages ?? 99) <= settings.maxUserMessages 
    ? 30 
    : ((candidate.counts?.totalMessages ?? 99) <= settings.maxTotalMessages ? 20 : 0);
  score += shortConversation;

  const oldAge = (candidate.dates?.ageDays ?? 0) > settings.olderThanDays ? 15 : 0;
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

  const noProtectedKeyword = (!candidate.signals?.protectedKeywordMatches || candidate.signals.protectedKeywordMatches.length === 0) ? 0 : -100;
  score += noProtectedKeyword;

  // Add penalties based on settings behavior block/warn/ignore
  if (candidate.signals?.isProject === true) {
    if (settings.projectBehavior === 'block') score -= 80;
    else if (settings.projectBehavior === 'warn') score -= 20;
  }
  if (candidate.signals?.hasFile === true) {
    if (settings.fileBehavior === 'block') score -= 60;
    else if (settings.fileBehavior === 'warn') score -= 15;
  }
  if (candidate.signals?.hasCode === true) {
    if (settings.codeBehavior === 'block') score -= 40;
    else if (settings.codeBehavior === 'warn') score -= 10;
  }

  const confidenceScore = candidate.sourceConfidence || 0;
  if (confidenceScore < settings.minSelectorConfidence) {
    score -= 100;
  }

  // Low content length: check if the character count is low
  let lowContentLength = 0;
  if (candidate.counts && candidate.contentLength) {
     lowContentLength = candidate.contentLength < 500 ? 10 : 0;
     score += lowContentLength;
  }

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
    confidence: confidenceScore,
  };
}

export function classifyScore(
  score: CandidateScore, 
  settings: CleanerSettings,
  riskFlags: string[] = [],
  ruleOverride?: "archive" | "delete" | "keep" | "none"
): "strong_archive_candidate" | "archive_candidate" | "delete_candidate" | "manual_review" | "ignore" | "protected" | "uncertain" {
  
  if (score.confidence < settings.minSelectorConfidence) return "uncertain";
  if (score.noProtectedKeyword === -100 || riskFlags.includes("protected_keyword")) return "protected";
  if (riskFlags.includes("current_chat")) return "protected";
  
  if (ruleOverride === "keep") return "protected";
  if (ruleOverride === "delete") return "delete_candidate";
  if (ruleOverride === "archive") return "strong_archive_candidate";
  
  if (score.total >= 90) return "strong_archive_candidate";
  if (score.total >= 70) return "archive_candidate";
  if (score.total >= 40) return "manual_review";
  if (settings.requireReview && score.total >= 10) return "manual_review";
  return "ignore";
}
