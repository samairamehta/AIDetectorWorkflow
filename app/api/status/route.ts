import { NextResponse } from "next/server";
import { allProviders } from "@/lib/providers";
import { saplingProvider } from "@/lib/providers/sapling";
import { keySource, isEnabled } from "@/lib/providers/store";
import { getPassThreshold } from "@/lib/settings";
import { getDb } from "@/lib/db";
import type { StatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasOverride = Boolean(
    getDb().prepare("SELECT 1 FROM settings WHERE key = 'pass_threshold'").get()
  );

  const response: StatusResponse = {
    providers: allProviders.map((p) => {
      const source = keySource(p.id, p.envVar);
      return {
        id: p.id,
        name: p.name,
        envVar: p.envVar,
        configured: source !== "none",
        enabled: isEnabled(p.id),
        source,
        hint: `Add a key in Settings, or set ${p.envVar} in .env.local.`,
      };
    }),
    saplingConfigured: saplingProvider.isConfigured(),
    passThreshold: getPassThreshold(),
    thresholdSource: hasOverride ? "settings" : "env",
  };
  return NextResponse.json(response);
}
