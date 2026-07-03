"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  getAllJobs: () => getAllJobs,
  getAllLogs: () => getAllLogs,
  getDB: () => getDB,
  getJob: () => getJob,
  getLogsByJob: () => getLogsByJob,
  getSettings: () => getSettings,
  saveJob: () => saveJob,
  saveLog: () => saveLog,
  saveSettings: () => saveSettings
});
module.exports = __toCommonJS(index_exports);

// src/idb-database.ts
var import_idb = require("idb");
var dbPromise = null;
async function getDB() {
  if (!dbPromise) {
    dbPromise = (0, import_idb.openDB)("ChatSweeperDB", 2, {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getAllJobs,
  getAllLogs,
  getDB,
  getJob,
  getLogsByJob,
  getSettings,
  saveJob,
  saveLog,
  saveSettings
});
