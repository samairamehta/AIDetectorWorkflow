import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { HistoryResponse, HistoryRow } from "@/lib/types";
import type { SentenceScore } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

interface DbRow extends Omit<HistoryRow, "topSentence"> {
  sentenceScores: string | null;
}

function topSentence(json: string | null): string | null {
  if (!json) return null;
  try {
    const scores = JSON.parse(json) as SentenceScore[];
    if (!Array.isArray(scores) || scores.length === 0) return null;
    let top = scores[0];
    for (const s of scores) {
      if (s.score > top.score) top = s;
    }
    return top.sentence;
  } catch {
    return null;
  }
}

// GET /api/history?verdict=PASS&from=2026-01-01&to=2026-02-01&q=press
export async function GET(request: Request) {
  const url = new URL(request.url);
  const verdict = url.searchParams.get("verdict");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q");

  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (verdict === "PASS" || verdict === "FLAG") {
    params.push(verdict);
    clauses.push(`s.verdict = $${params.length}`);
  }
  if (from) {
    const ts = Date.parse(from);
    if (!Number.isNaN(ts)) {
      params.push(ts);
      clauses.push(`s.created_at >= $${params.length}`);
    }
  }
  if (to) {
    const ts = Date.parse(to);
    if (!Number.isNaN(ts)) {
      // Include the whole end day.
      params.push(ts + 24 * 60 * 60 * 1000);
      clauses.push(`s.created_at < $${params.length}`);
    }
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`s.title ILIKE $${params.length}`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const db = await getDb();
  const dbRows = (await db.unsafe(
    `SELECT s.id AS "scanId", s.created_at AS "createdAt", s.title, s.chars,
            s.verdict, r.provider, r.score, r.label,
            r.sentence_scores AS "sentenceScores"
     FROM scans s JOIN results r ON r.scan_id = s.id
     ${where}
     ORDER BY s.created_at DESC, r.provider ASC
     LIMIT 2000`,
    params
  )) as unknown as DbRow[];

  const rows: HistoryRow[] = dbRows.map(({ sentenceScores, ...row }) => ({
    ...row,
    topSentence: topSentence(sentenceScores),
  }));

  const response: HistoryResponse = { rows };
  return NextResponse.json(response);
}

// DELETE /api/history clears all scans and results. The usage log is
// kept on purpose, the quota must stay accurate to what Sapling saw.
export async function DELETE() {
  const db = await getDb();
  // Deleting scans cascades to results (FK ON DELETE CASCADE).
  await db.unsafe("DELETE FROM scans");
  return NextResponse.json({ ok: true });
}
