import { getDb } from "./db";
import { envPassThreshold } from "./config";

// The pass threshold can be overridden from the Settings page.
// SQLite value wins over the env default.

export function getPassThreshold(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'pass_threshold'")
    .get() as { value: string } | undefined;
  if (row) {
    const parsed = Number(row.value);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) return parsed;
  }
  return envPassThreshold();
}

export function setPassThreshold(value: number): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('pass_threshold', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(value));
}

export function clearPassThreshold(): void {
  getDb().prepare("DELETE FROM settings WHERE key = 'pass_threshold'").run();
}
