import { NextResponse } from "next/server";
import { providerById, ProviderError } from "@/lib/providers";
import {
  setStoredKey,
  deleteStoredKey,
  setEnabled,
  keySource,
} from "@/lib/providers/store";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// POST { id, key } tests the key with a live request and, if it works,
// stores it and enables the provider.
export async function POST(request: Request) {
  let body: { id?: string; key?: string };
  try {
    body = (await request.json()) as { id?: string; key?: string };
  } catch {
    return bad("Request body must be JSON.");
  }

  const provider = body.id ? providerById(body.id) : undefined;
  if (!provider) return bad("Unknown provider.");
  const key = body.key?.trim();
  if (!key) return bad("Enter an API key to test.");

  try {
    await provider.testKey(key);
  } catch (err) {
    const message =
      err instanceof ProviderError ? err.message : `${provider.name} test failed.`;
    // 422: the key was reachable but rejected or the test did not pass.
    return bad(message, 422);
  }

  setStoredKey(provider.id, key);
  return NextResponse.json({ ok: true, id: provider.id });
}

// PATCH { id, enabled } selects or deselects a connected provider for scans.
export async function PATCH(request: Request) {
  let body: { id?: string; enabled?: boolean };
  try {
    body = (await request.json()) as { id?: string; enabled?: boolean };
  } catch {
    return bad("Request body must be JSON.");
  }
  const provider = body.id ? providerById(body.id) : undefined;
  if (!provider) return bad("Unknown provider.");
  if (typeof body.enabled !== "boolean") return bad("`enabled` must be a boolean.");

  setEnabled(provider.id, provider.envVar, body.enabled);
  return NextResponse.json({ ok: true });
}

// DELETE ?id=... removes a stored key. Env-provided keys cannot be removed here.
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const provider = id ? providerById(id) : undefined;
  if (!provider) return bad("Unknown provider.");
  if (keySource(provider.id, provider.envVar) === "env") {
    return bad(
      `${provider.name} is configured through ${provider.envVar} in your env file. Remove it there instead.`,
      409
    );
  }
  deleteStoredKey(provider.id);
  return NextResponse.json({ ok: true });
}
