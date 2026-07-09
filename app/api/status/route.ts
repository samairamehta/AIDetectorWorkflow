import { NextResponse } from "next/server";
import { allProviders } from "@/lib/providers";
import { saplingProvider } from "@/lib/providers/sapling";
import { keySource, isEnabled } from "@/lib/providers/store";
import { getPassThreshold } from "@/lib/settings";
import { getDb } from "@/lib/db";
import type { StatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  // Queries run sequentially on purpose: the Supabase transaction pooler does
  // not tolerate pipelined concurrent queries on a single connection.
  const overrideRows = await db.unsafe(
    "SELECT 1 FROM settings WHERE key = 'pass_threshold'"
  );
  const hasOverride = overrideRows.length > 0;

  const providers = [];
  for (const p of allProviders) {
    const source = await keySource(p.id, p.envVar);
    providers.push({
      id: p.id,
      name: p.name,
      envVar: p.envVar,
      configured: source !== "none",
      enabled: await isEnabled(p.id),
      source,
      hint: `Add a key in Settings, or set ${p.envVar} in .env.local.`,
    });
  }

  const saplingConfigured = await saplingProvider.isConfigured();
  const passThreshold = await getPassThreshold();

  const response: StatusResponse = {
    providers,
    saplingConfigured,
    passThreshold,
    thresholdSource: hasOverride ? "settings" : "env",
  };
  return NextResponse.json(response);
}
