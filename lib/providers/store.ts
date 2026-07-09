import { getDb } from "../db";

// Provider API keys can come from two places:
//   1. Environment variables (SAPLING_API_KEY, ...), which always win.
//   2. Keys added through the Settings UI, stored in SQLite.
// A key from either source makes a provider "configured". The `enabled`
// flag lets the user select which configured providers run during a scan.

export type KeySource = "env" | "stored" | "none";

interface KeyRow {
  api_key: string;
  enabled: number;
}

function row(id: string): KeyRow | undefined {
  return getDb()
    .prepare("SELECT api_key, enabled FROM provider_keys WHERE provider = ?")
    .get(id) as KeyRow | undefined;
}

// Resolve the usable key for a provider, env first then stored.
export function resolveKey(id: string, envVar: string): string | null {
  const env = process.env[envVar]?.trim();
  if (env) return env;
  return row(id)?.api_key ?? null;
}

export function keySource(id: string, envVar: string): KeySource {
  if (process.env[envVar]?.trim()) return "env";
  if (row(id)) return "stored";
  return "none";
}

export function setStoredKey(id: string, key: string): void {
  getDb()
    .prepare(
      `INSERT INTO provider_keys (provider, api_key, enabled, created_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(provider) DO UPDATE SET api_key = excluded.api_key`
    )
    .run(id, key, Date.now());
}

export function deleteStoredKey(id: string): void {
  getDb().prepare("DELETE FROM provider_keys WHERE provider = ?").run(id);
}

// Enabled defaults to true. Env-only providers have no row, so they read
// as enabled unless the user explicitly disables them (which writes a row
// carrying the disabled flag but an empty stored key marker).
export function isEnabled(id: string): boolean {
  const r = row(id);
  if (!r) return true;
  return r.enabled === 1;
}

export function setEnabled(id: string, envVar: string, enabled: boolean): void {
  const existing = row(id);
  if (existing) {
    getDb()
      .prepare("UPDATE provider_keys SET enabled = ? WHERE provider = ?")
      .run(enabled ? 1 : 0, id);
    return;
  }
  // No stored key (env-configured). Record the enabled flag with a marker
  // so the choice persists. resolveKey still prefers the env var.
  if (process.env[envVar]?.trim()) {
    getDb()
      .prepare(
        `INSERT INTO provider_keys (provider, api_key, enabled, created_at)
         VALUES (?, '', ?, ?)
         ON CONFLICT(provider) DO UPDATE SET enabled = excluded.enabled`
      )
      .run(id, enabled ? 1 : 0, Date.now());
  }
}
