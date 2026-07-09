import { NextResponse } from "next/server";
import { getQuota } from "@/lib/quota";
import type { QuotaResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const quota = await getQuota();
  const response: QuotaResponse = quota;
  return NextResponse.json(response);
}