import postgres, { type Sql } from "postgres";

// Storage is Supabase Postgres, reached over the connection pooler. postgres.js
// with `prepare: false` is the pooler-safe setup (transaction pooling does not
// keep server-side prepared statements). This runs on Vercel serverless, where
// a file-based SQLite (better-sqlite3) cannot: the filesystem is read-only.
//
// Set DATABASE_URL to the Supabase "Transaction pooler" connection string
// (Project Settings -> Database -> Connection string), in .env.local for local
// dev and in the Vercel project's Environment Variables for production.

const globalForDb = globalThis as unknown as {
  __detectdeckSql?: Sql;
  __detectdeckInit?: Promise<void>;
};

// Schema, one statement per array entry. epoch-ms timestamps stay BIGINT so the
// quota math (Date.now()) carries over unchanged; the int8 parser below returns
// them (and all ids/SUMs) as JS numbers, which is safe below 2^53.
const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS scans (
     id BIGSERIAL PRIMARY KEY,
     created_at BIGINT NOT NULL,
     title TEXT NOT NULL,
     chars INTEGER NOT NULL,
     verdict TEXT NOT NULL CHECK (verdict IN ('PASS', 'FLAG'))
   )`,
  `CREATE TABLE IF NOT EXISTS results (
     id BIGSERIAL PRIMARY KEY,
     scan_id BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
     provider TEXT NOT NULL,
     score DOUBLE PRECISION NOT NULL,
     label TEXT NOT NULL CHECK (label IN ('human', 'mixed', 'ai')),
     sentence_scores TEXT,
     raw TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS usage_log (
     id BIGSERIAL PRIMARY KEY,
     created_at BIGINT NOT NULL,
     chars INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS provider_keys (
     provider TEXT PRIMARY KEY,
     api_key TEXT NOT NULL,
     enabled INTEGER NOT NULL DEFAULT 1,
     created_at BIGINT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_results_scan ON results(scan_id)`,
];

function client(): Sql {
  if (!globalForDb.__detectdeckSql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add the Supabase connection-pooler string to " +
          ".env.local for local dev and to the Vercel project's environment variables."
      );
    }
    globalForDb.__detectdeckSql = postgres(url, {
      prepare: false, // required for Supabase transaction pooler
      ssl: "require",
      // Small pool: enough that concurrent requests each get their own
      // connection (the transaction pooler mishandles pipelined queries on a
      // shared connection), but low enough to be safe on serverless.
      max: 5,
      // Return int8 (BIGSERIAL ids, BIGINT timestamps, SUM/MIN) as JS numbers
      // instead of BigInt/string. All values here stay well under 2^53.
      types: {
        bigint: {
          to: 20,
          from: [20],
          serialize: (x: number) => x.toString(),
          parse: (x: string) => Number(x),
        },
      },
    });
  }
  return globalForDb.__detectdeckSql;
}

// Ensure the schema exists. Runs once per process; the promise is cached so
// concurrent requests share a single migration and later calls are free.
function ensureSchema(): Promise<void> {
  if (!globalForDb.__detectdeckInit) {
    globalForDb.__detectdeckInit = (async () => {
      const sql = client();
      for (const stmt of SCHEMA) {
        await sql.unsafe(stmt);
      }
    })().catch((err) => {
      // Reset so a transient failure can be retried on the next request.
      globalForDb.__detectdeckInit = undefined;
      throw err;
    });
  }
  return globalForDb.__detectdeckInit;
}

export async function getDb(): Promise<Sql> {
  await ensureSchema();
  return client();
}
