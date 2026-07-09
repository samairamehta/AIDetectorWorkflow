import { getDb } from "@/lib/db";
import type { HistoryRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// GET /api/export?format=csv&scanId=12 (scanId optional, exports everything otherwise)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (format !== "csv") {
    return Response.json(
      { error: `Unsupported export format "${format}". Use format=csv.` },
      { status: 400 }
    );
  }

  const scanId = url.searchParams.get("scanId");
  const where = scanId ? "WHERE s.id = ?" : "";
  const params = scanId ? [Number(scanId)] : [];

  const rows = getDb()
    .prepare(
      `SELECT s.id AS scanId, s.created_at AS createdAt, s.title, s.chars,
              s.verdict, r.provider, r.score, r.label
       FROM scans s JOIN results r ON r.scan_id = s.id
       ${where}
       ORDER BY s.created_at DESC, r.provider ASC`
    )
    .all(...params) as HistoryRow[];

  const header = "date,title,provider,score,label,verdict,chars";
  const lines = rows.map((row) =>
    [
      new Date(row.createdAt).toISOString(),
      csvEscape(row.title),
      row.provider,
      row.score.toFixed(4),
      row.label,
      row.verdict,
      String(row.chars),
    ].join(",")
  );
  const csv = [header, ...lines].join("\r\n") + "\r\n";

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = scanId
    ? `detectdeck-scan-${scanId}.csv`
    : `detectdeck-history-${stamp}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
