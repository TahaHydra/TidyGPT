import type { CandidateScore, ConversationCandidate } from '@tidygpt/shared';

export function calculateScore(candidate: Partial<ConversationCandidate>, settings: any): CandidateScore {
  let score = 0;
  
  const shortConversation = (candidate.counts?.userMessages ?? 99) <= 1 ? 30 : ((candidate.counts?.totalMessages ?? 99) <= 3 ? 20 : 0);
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

  // Add penalties based on settings
  if (candidate.signals?.isProject && !settings.skipProjects) {
    score -= 80;
  }
  if (candidate.signals?.hasFile && !settings.skipFiles) {
    score -= 60;
  }
  if (candidate.signals?.hasCode && settings.codeHandling !== 'ignore') {
    score -= 40;
  }

  const confidenceScore = candidate.sourceConfidence || 0;
  if (confidenceScore < 0.5) {
    score -= 100;
  }

  const lowContentLength = 0; // Not fully implemented

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

export function classifyScore(score: CandidateScore): "strong_archive_candidate" | "archive_candidate" | "manual_review" | "ignore" | "protected" | "uncertain" {
  if (score.confidence < 0.5) return "uncertain";
  if (score.noProtectedKeyword === -100) return "protected";
  if (score.total >= 90) return "strong_archive_candidate";
  if (score.total >= 70) return "archive_candidate";
  if (score.total >= 40) return "manual_review";
  return "ignore";
}
