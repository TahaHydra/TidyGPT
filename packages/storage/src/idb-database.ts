import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { CleanupJob, ConversationCandidate, CleanerSettings, LogEntry } from '@tidygpt/shared';

interface SweeperDB extends DBSchema {
  jobs: {
    key: string;
    value: CleanupJob;
  };
  settings: {
    key: string;
    value: CleanerSettings;
  };
  logs: {
    key: string;
    value: LogEntry;
    indexes: { 'by-job': string };
  };
}

let dbPromise: Promise<IDBPDatabase<SweeperDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SweeperDB>('ChatSweeperDB', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('jobs', { keyPath: 'jobId' });
          db.createObjectStore('settings');
        }
        if (oldVersion < 2) {
          const logsStore = db.createObjectStore('logs', { keyPath: 'id' });
          logsStore.createIndex('by-job', 'jobId');
        }
        if (oldVersion < 3 && oldVersion >= 1) {
          // Migration: only delete and recreate jobs if upgrading from v1/v2 (not fresh install)
          if (db.objectStoreNames.contains('jobs')) {
            db.deleteObjectStore('jobs');
          }
          db.createObjectStore('jobs', { keyPath: 'jobId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveJob(job: CleanupJob) {
  const db = await getDB();
  await db.put('jobs', job);
}

export async function updateJob(jobId: string, updates: Partial<CleanupJob>) {
  const db = await getDB();
  const tx = db.transaction('jobs', 'readwrite');
  const store = tx.objectStore('jobs');
  const job = await store.get(jobId);
  if (job) {
    await store.put({ ...job, ...updates });
  }
  await tx.done;
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

export async function saveLog(log: LogEntry) {
  const db = await getDB();
  await db.put('logs', log);
}

export async function getLogsByJob(jobId: string): Promise<LogEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('logs', 'by-job', jobId);
}

export async function getAllLogs(): Promise<LogEntry[]> {
  const db = await getDB();
  return db.getAll('logs');
}
