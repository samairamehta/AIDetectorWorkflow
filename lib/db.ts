import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __detectdeckDb?: Database.Database };

function open(): Database.Database {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "history.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      title TEXT NOT NULL,
      chars INTEGER NOT NULL,
      verdict TEXT NOT NULL CHECK (verdict IN ('PASS', 'FLAG'))
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      score REAL NOT NULL,
      label TEXT NOT NULL CHECK (label IN ('human', 'mixed', 'ai')),
      sentence_scores TEXT,
      raw TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      chars INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_keys (
      provider TEXT PRIMARY KEY,
      api_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_results_scan ON results(scan_id);
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__detectdeckDb) {
    globalForDb.__detectdeckDb = open();
  }
  return globalForDb.__detectdeckDb;
}
