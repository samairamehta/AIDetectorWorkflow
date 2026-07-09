import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getQuota, logUsage, whenBudgetFrees } from "@/lib/quota";
import { getPassThreshold } from "@/lib/settings";
import { activeProviders, ProviderError } from "@/lib/providers";
import { MIN_RELIABLE_CHARS } from "@/lib/config";
import type {
  DetectRequestText,
  DetectResponse,
  ProviderOutcome,
  ScanOutcome,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface DetectBody {
  texts: DetectRequestText[];
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: DetectBody;
  try {
    body = (await request.json()) as DetectBody;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  if (!Array.isArray(body.texts) || body.texts.length === 0) {
    return badRequest("Provide at least one text to scan.");
  }
  for (const t of body.texts) {
    if (typeof t.content !== "string" || t.content.trim().length === 0) {
      return badRequest(`"${t.title || t.id}" is empty. Remove it or add content.`);
    }
  }

  const providers = activeProviders();
  if (providers.length === 0) {
    return badRequest(
      "No detection provider is active. Add a key in Settings, or select at least one connected provider.",
      503
    );
  }

  // Budget check happens against the whole batch before any request is sent.
  const totalChars =
    body.texts.reduce((sum, t) => sum + t.content.length, 0) * providers.length;
  const quota = getQuota();
  if (totalChars > quota.remaining) {
    const freesAt = whenBudgetFrees(totalChars);
    const when =
      freesAt === null
        ? "This batch is larger than the whole daily budget, split it up."
        : `Enough budget frees up at ${new Date(freesAt).toLocaleString()}.`;
    return badRequest(
      `This batch needs ${totalChars.toLocaleString()} detector characters but only ${quota.remaining.toLocaleString()} remain in the daily budget. ${when}`,
      429
    );
  }

  const db = getDb();
  const threshold = getPassThreshold();
  const results: ScanOutcome[] = [];

  for (const text of body.texts) {
    const outcomes: ProviderOutcome[] = [];

    for (const provider of providers) {
      // Usage is logged per provider request, whether or not it succeeds,
      // since the provider still counts it against their quota.
      logUsage(text.content.length);
      try {
        const detection = await provider.detect(text.content);
        outcomes.push({
          provider: provider.id,
          providerName: provider.name,
          ok: true,
          score: detection.aiScore,
          label: detection.label,
          sentenceScores: detection.sentenceScores,
          raw: detection.raw,
        } as ProviderOutcome & { raw: unknown });
      } catch (err) {
        const message =
          err instanceof ProviderError
            ? err.message
            : `${provider.name} failed unexpectedly.`;
        outcomes.push({
          provider: provider.id,
          providerName: provider.name,
          ok: false,
          error: message,
        });
      }
    }

    const succeeded = outcomes.filter((o) => o.ok);
    let scanId: number | null = null;
    let verdict: "PASS" | "FLAG" | null = null;

    if (succeeded.length > 0) {
      verdict = succeeded.every((o) => (o.score ?? 1) < threshold)
        ? "PASS"
        : "FLAG";
      const insertScan = db.prepare(
        "INSERT INTO scans (created_at, title, chars, verdict) VALUES (?, ?, ?, ?)"
      );
      const insertResult = db.prepare(
        "INSERT INTO results (scan_id, provider, score, label, sentence_scores, raw) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const persist = db.transaction(() => {
        const info = insertScan.run(
          Date.now(),
          text.title || "Untitled",
          text.content.length,
          verdict
        );
        const newScanId = Number(info.lastInsertRowid);
        for (const o of succeeded) {
          const withRaw = o as ProviderOutcome & { raw?: unknown };
          insertResult.run(
            newScanId,
            o.provider,
            o.score,
            o.label,
            o.sentenceScores ? JSON.stringify(o.sentenceScores) : null,
            withRaw.raw !== undefined ? JSON.stringify(withRaw.raw) : null
          );
        }
        return newScanId;
      });
      scanId = persist();
    }

    // Strip raw payloads from the API response, they live in SQLite.
    const cleanOutcomes: ProviderOutcome[] = outcomes.map((o) => {
      const { provider, providerName, ok, score, label, sentenceScores, error } =
        o as ProviderOutcome & { raw?: unknown };
      return { provider, providerName, ok, score, label, sentenceScores, error };
    });

    results.push({
      id: text.id,
      scanId,
      title: text.title || "Untitled",
      chars: text.content.length,
      verdict,
      shortText: text.content.length < MIN_RELIABLE_CHARS,
      providers: cleanOutcomes,
    });
  }

  const response: DetectResponse = { results, quota: getQuota() };
  return NextResponse.json(response);
}
