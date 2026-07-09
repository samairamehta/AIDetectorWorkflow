import { NextResponse } from "next/server";
import { setPassThreshold, clearPassThreshold, getPassThreshold } from "@/lib/settings";

export const dynamic = "force-dynamic";

// POST { passThreshold: number } persists an override.
// POST { passThreshold: null } clears it back to the env default.
export async function POST(request: Request) {
  let body: { passThreshold?: number | null };
  try {
    body = (await request.json()) as { passThreshold?: number | null };
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (body.passThreshold === null) {
    await clearPassThreshold();
    return NextResponse.json({ passThreshold: await getPassThreshold() });
  }

  const value = Number(body.passThreshold);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    return NextResponse.json(
      { error: "Pass threshold must be a number greater than 0 and at most 1." },
      { status: 400 }
    );
  }

  await setPassThreshold(value);
  return NextResponse.json({ passThreshold: await getPassThreshold() });
}
