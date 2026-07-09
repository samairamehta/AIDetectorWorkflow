import { getDb } from "../db";

// Provider API keys can come from two places:
//   1. Environment variables (SAPLING_API_KEY, ...), which always win.
//   2. Keys added through the Settings UI, stored in the database.
// A key from either source makes a provider "configured". The `enabled`
// flag lets the user select which configured providers run during a scan.

export type KeySource = "env" | "stored" | "none";

interface KeyRow {
  api_key: string;
  enabled: number;
}

async function row(id: string): Promise<KeyRow | undefined> {
  const db = await getDb();
  const rows = await db.unsafe(
    "SELECT api_key, enabled FROM provider_keys WHERE provider = $1",
    [id]
  );
  return rows[0] as unknown as KeyRow | undefined;
}

// Resolve the usable key for a provider, env first then stored.
export async function resolveKey(id: string, envVar: string): Promise<string | null> {
  const env = process.env[envVar]?.trim();
  if (env) return env;
  return (await row(id))?.api_key ?? null;
}

export async function keySource(id: string, envVar: string): Promise<KeySource> {
  if (process.env[envVar]?.trim()) return "env";
  if (await row(id)) return "stored";
  return "none";
}

export async function setStoredKey(id: string, key: string): Promise<void> {
  const db = await getDb();
  await db.unsafe(
    `INSERT INTO provider_keys (provider, api_key, enabled, created_at)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT(provider) DO UPDATE SET api_key = excluded.api_key`,
    [id, key, Date.now()]
  );
}

export async function deleteStoredKey(id: string): Promise<void> {
  const db = await getDb();
  await db.unsafe("DELETE FROM provider_keys WHERE provider = $1", [id]);
}

// Enabled defaults to true. Env-only providers have no row, so they read
// as enabled unless the user explicitly disables them (which writes a row
// carrying the disabled flag but an empty stored key marker).
export async function isEnabled(id: string): Promise<boolean> {
  const r = await row(id);
  if (!r) return true;
  return r.enabled === 1;
}

export async function setEnabled(
  id: string,
  envVar: string,
  enabled: boolean
): Promise<void> {
  const db = await getDb();
  const existing = await row(id);
  if (existing) {
    await db.unsafe("UPDATE provider_keys SET enabled = $1 WHERE provider = $2", [
      enabled ? 1 : 0,
      id,
    ]);
    return;
  }
  // No stored key (env-configured). Record the enabled flag with a marker
  // so the choice persists. resolveKey still prefers the env var.
  if (process.env[envVar]?.trim()) {
    await db.unsafe(
      `INSERT INTO provider_keys (provider, api_key, enabled, created_at)
       VALUES ($1, '', $2, $3)
       ON CONFLICT(provider) DO UPDATE SET enabled = excluded.enabled`,
      [id, enabled ? 1 : 0, Date.now()]
    );
  }
}
