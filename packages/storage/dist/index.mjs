// src/idb-database.ts
import { openDB } from "idb";
var dbPromise = null;
async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB("ChatSweeperDB", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("jobs", { keyPath: "id" });
          db.createObjectStore("settings");
        }
        if (oldVersion < 2) {
          const logsStore = db.createObjectStore("logs", { keyPath: "id" });
          logsStore.createIndex("by-job", "jobId");
        }
      }
    });
  }
  return dbPromise;
}
async function saveJob(job) {
  const db = await getDB();
  await db.put("jobs", job);
}
async function getJob(id) {
  const db = await getDB();
  return db.get("jobs", id);
}
async function getAllJobs() {
  const db = await getDB();
  return db.getAll("jobs");
}
async function saveSettings(settings) {
  const db = await getDB();
  await db.put("settings", settings, "user-settings");
}
async function getSettings() {
  const db = await getDB();
  return db.get("settings", "user-settings");
}
async function saveLog(log) {
  const db = await getDB();
  await db.put("logs", log);
}
async function getLogsByJob(jobId) {
  const db = await getDB();
  return db.getAllFromIndex("logs", "by-job", jobId);
}
async function getAllLogs() {
  const db = await getDB();
  return db.getAll("logs");
}
export {
  getAllJobs,
  getAllLogs,
  getDB,
  getJob,
  getLogsByJob,
  getSettings,
  saveJob,
  saveLog,
  saveSettings
};
