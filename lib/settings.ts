import { getDb } from "./db";
import { envPassThreshold } from "./config";

// The pass threshold can be overridden from the Settings page.
// The stored value wins over the env default.

export async function getPassThreshold(): Promise<number> {
  const db = await getDb();
  const rows = await db.unsafe(
    "SELECT value FROM settings WHERE key = 'pass_threshold'"
  );
  const row = rows[0] as unknown as { value: string } | undefined;
  if (row) {
    const parsed = Number(row.value);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) return parsed;
  }
  return envPassThreshold();
}

export async function setPassThreshold(value: number): Promise<void> {
  const db = await getDb();
  await db.unsafe(
    "INSERT INTO settings (key, value) VALUES ('pass_threshold', $1) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [String(value)]
  );
}

export async function clearPassThreshold(): Promise<void> {
  const db = await getDb();
  await db.unsafe("DELETE FROM settings WHERE key = 'pass_threshold'");
}
