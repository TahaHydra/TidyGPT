import { describe, it, expect } from 'vitest';
import { ExportProvider } from './export-provider';
import type { CleanerSettings } from '@tidygpt/shared';

describe('Export Provider', () => {
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

  it('generates candidates correctly', async () => {
    const provider = new ExportProvider(defaultSettings);
    const mockData = [{
      id: "test1",
      title: "Test chat",
      create_time: 1672531200,
      update_time: 1672531200,
      mapping: {
        "msg1": { message: { author: { role: "user" }, content: { parts: ["Hello"] } } },
        "msg2": { message: { author: { role: "assistant" }, content: { parts: ["Hi"] } } }
      }
    }];

    await provider.loadFromJSON(mockData);
    const candidates = await provider.generateCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0].counts.totalMessages).toBe(2);
    expect(candidates[0].counts.userMessages).toBe(1);
    expect(candidates[0].counts.assistantMessages).toBe(1);

    const backups = await provider.generateBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].providerKey).toBe('chatgpt:test1');
    expect(backups[0].messages.map(message => message.text)).toEqual(['Hello', 'Hi']);
  });
});
