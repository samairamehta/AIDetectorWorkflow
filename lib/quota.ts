import { getDb } from "./db";
import { dailyCharBudget } from "./config";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface QuotaState {
  budget: number;
  used: number;
  remaining: number;
  // Epoch ms when the oldest in-window usage entry expires and
  // characters start freeing up. Null when nothing is in the window.
  nextReleaseAt: number | null;
}

export async function getQuota(now = Date.now()): Promise<QuotaState> {
  const db = await getDb();
  const since = now - WINDOW_MS;
  const rows = await db.unsafe(
    "SELECT COALESCE(SUM(chars), 0)::bigint AS used, MIN(created_at) AS oldest " +
      "FROM usage_log WHERE created_at > $1",
    [since]
  );
  const row = rows[0] as unknown as { used: number; oldest: number | null };
  const budget = dailyCharBudget();
  return {
    budget,
    used: row.used,
    remaining: Math.max(0, budget - row.used),
    nextReleaseAt: row.oldest === null ? null : row.oldest + WINDOW_MS,
  };
}

// When would enough budget free up to fit `needed` chars?
// Walks in-window usage oldest-first, accumulating released chars.
export async function whenBudgetFrees(
  needed: number,
  now = Date.now()
): Promise<number | null> {
  const db = await getDb();
  const since = now - WINDOW_MS;
  const quota = await getQuota(now);
  if (needed <= quota.remaining) return now;
  if (needed > quota.budget) return null; // can never fit
  const rows = (await db.unsafe(
    "SELECT created_at, chars FROM usage_log WHERE created_at > $1 ORDER BY created_at ASC",
    [since]
  )) as unknown as { created_at: number; chars: number }[];
  let freed = 0;
  for (const row of rows) {
    freed += row.chars;
    if (quota.remaining + freed >= needed) return row.created_at + WINDOW_MS;
  }
  return null;
}

export async function logUsage(chars: number, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.unsafe("INSERT INTO usage_log (created_at, chars) VALUES ($1, $2)", [
    now,
    chars,
  ]);
}
