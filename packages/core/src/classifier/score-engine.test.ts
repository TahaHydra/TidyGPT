import { describe, it, expect } from 'vitest';
import { calculateScore, classifyScore } from './score-engine';
import type { CleanerSettings } from '@tidygpt/shared';

describe('Score Engine', () => {
  const defaultSettings: CleanerSettings = {
    maxUserMessages: 1,
    maxTotalMessages: 3,
    olderThanDays: 30,
    codeBehavior: "warn",
    fileBehavior: "block",
    projectBehavior: "block",
    protectedKeywords: ["secret"],
    minSelectorConfidence: 0.8,
    delayMinMs: 1000,
    delayMaxMs: 3000,
    requireReview: true,
    deleteConfirmationString: "CONFIRM",
    logTitleAndUrl: true,
    theme: "dark"
  };

  it('scores short conversations high', () => {
    const candidate: any = {
      counts: { userMessages: 1, totalMessages: 2 },
      sourceConfidence: 1.0
    };
    const score = calculateScore(candidate, defaultSettings);
    expect(score.shortConversation).toBe(30);
  });

  it('penalizes low confidence', () => {
    const candidate: any = {
      sourceConfidence: 0.5
    };
    const score = calculateScore(candidate, defaultSettings);
    expect(score.total).toBeLessThan(0);
  });

  it('classifies protected keyword as protected', () => {
    const candidate: any = {
      counts: { userMessages: 1, totalMessages: 2 }, // normally archive
      sourceConfidence: 1.0,
      signals: {
        protectedKeywordMatches: ["secret"]
      }
    };
    const score = calculateScore(candidate, defaultSettings);
    const classification = classifyScore(score, defaultSettings, ["protected_keyword"]);
    expect(classification).toBe("protected");
  });

  it('classifies normal short chat as archive_candidate', () => {
    const candidate: any = {
      counts: { userMessages: 1, totalMessages: 2 },
      dates: { ageDays: 40 },
      signals: { genericTitle: true, hasFile: false, hasCode: false, isProject: false },
      sourceConfidence: 1.0
    };
    const score = calculateScore(candidate, defaultSettings);
    const classification = classifyScore(score, defaultSettings);
    expect(classification).toBe("archive_candidate");
  });
});
