import { describe, it, expect } from 'vitest';
import { calculateScore, classifyScore } from './score-engine';
import { evaluateRules } from './rule-engine';
import type { CleanerSettings } from '@tidygpt/shared';

describe('Score Engine', () => {
  const defaultSettings: CleanerSettings = {
    maxUserMessages: 1,
    maxTotalMessages: 3,
    olderThanDays: 30,
    codeBehavior: "warn",
    fileBehavior: "block",
    imageBehavior: "warn",
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

  it('applies body rules to live content text', () => {
    const result = evaluateRules(
      { title: 'Ordinary title', contentLength: 42 },
      {
        builtInSettings: defaultSettings,
        customRules: [{
          id: 'protect-client', name: 'Keep client work', type: 'keep',
          conditions: { bodyRegex: 'client[- ]alpha', minContentLength: 10 },
        }],
      },
      'Notes for Client Alpha'
    );
    expect(result).toBe('keep');
  });

  it('ignores invalid custom regex safely', () => {
    const result = evaluateRules(
      { title: 'Anything' },
      {
        builtInSettings: defaultSettings,
        customRules: [{ id: 'bad', name: 'Bad regex', type: 'delete', conditions: { bodyRegex: '[' } }],
      },
      'content'
    );
    expect(result).toBe('none');
  });

  it('lets protection win even when an earlier delete rule matches', () => {
    const result = evaluateRules(
      { counts: { totalMessages: 2, countConfidence: 1 }, title: 'Important client plan' },
      {
        builtInSettings: defaultSettings,
        customRules: [
          { id: 'short', name: 'Delete short', type: 'delete', conditions: { maxTotalMessages: 20 } },
          { id: 'client', name: 'Protect client', type: 'keep', conditions: { titleContains: 'client' } },
        ],
      },
    );
    expect(result).toBe('keep');
  });

  it('does not treat unknown file detection as no files', () => {
    const result = evaluateRules(
      { signals: { hasFile: 'unknown' } as any },
      {
        builtInSettings: defaultSettings,
        customRules: [{ id: 'empty', name: 'No files', type: 'delete', conditions: { noFiles: true } }],
      },
    );
    expect(result).toBe('none');
  });
});
