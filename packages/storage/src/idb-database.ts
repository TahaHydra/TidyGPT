import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { CleanupJob, ConversationCandidate, CleanerSettings } from '@tidygpt/shared';

interface SweeperDB extends DBSchema {
  jobs: {
    key: string;
    value: CleanupJob;
  };
  settings: {
    key: string;
    value: CleanerSettings;
  };
}

let dbPromise: Promise<IDBPDatabase<SweeperDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SweeperDB>('ChatSweeperDB', 1, {
      upgrade(db) {
        db.createObjectStore('jobs', { keyPath: 'id' });
        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

export async function saveJob(job: CleanupJob) {
  const db = await getDB();
  await db.put('jobs', job);
}

export async function getJob(id: string): Promise<CleanupJob | undefined> {
  const db = await getDB();
  return db.get('jobs', id);
}

export async function getAllJobs(): Promise<CleanupJob[]> {
  const db = await getDB();
  return db.getAll('jobs');
}

export async function saveSettings(settings: CleanerSettings) {
  const db = await getDB();
  await db.put('settings', settings, 'user-settings');
}

export async function getSettings(): Promise<CleanerSettings | undefined> {
  const db = await getDB();
  return db.get('settings', 'user-settings');
}
