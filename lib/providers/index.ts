import { DetectorProvider } from "./types";
import { saplingProvider } from "./sapling";
import { gptzeroProvider } from "./gptzero";
import { pangramProvider } from "./pangram";
import { isEnabled } from "./store";

export const allProviders: DetectorProvider[] = [
  saplingProvider,
  gptzeroProvider,
  pangramProvider,
];

export function providerById(id: string): DetectorProvider | undefined {
  return allProviders.find((p) => p.id === id);
}

// Every provider that has a usable key (env or stored).
// Queries run sequentially on purpose: the Supabase transaction pooler does
// not tolerate pipelined concurrent queries on a single connection.
export async function configuredProviders(): Promise<DetectorProvider[]> {
  const out: DetectorProvider[] = [];
  for (const p of allProviders) {
    if (await p.isConfigured()) out.push(p);
  }
  return out;
}

// Providers actually used in a scan: configured AND selected by the user.
export async function activeProviders(): Promise<DetectorProvider[]> {
  const out: DetectorProvider[] = [];
  for (const p of allProviders) {
    if ((await p.isConfigured()) && (await isEnabled(p.id))) out.push(p);
  }
  return out;
}

export * from "./types";
