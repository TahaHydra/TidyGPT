import { IDBPDatabase, DBSchema } from 'idb';
import { CleanupJob, LogEntry, CleanerSettings } from '@tidygpt/shared';

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
        indexes: {
            'by-job': string;
        };
    };
}
declare function getDB(): Promise<IDBPDatabase<SweeperDB>>;
declare function saveJob(job: CleanupJob): Promise<void>;
declare function getJob(id: string): Promise<CleanupJob | undefined>;
declare function getAllJobs(): Promise<CleanupJob[]>;
declare function saveSettings(settings: CleanerSettings): Promise<void>;
declare function getSettings(): Promise<CleanerSettings | undefined>;
declare function saveLog(log: LogEntry): Promise<void>;
declare function getLogsByJob(jobId: string): Promise<LogEntry[]>;
declare function getAllLogs(): Promise<LogEntry[]>;

export { getAllJobs, getAllLogs, getDB, getJob, getLogsByJob, getSettings, saveJob, saveLog, saveSettings };
