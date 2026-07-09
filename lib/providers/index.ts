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
export function configuredProviders(): DetectorProvider[] {
  return allProviders.filter((p) => p.isConfigured());
}

// Providers actually used in a scan: configured AND selected by the user.
export function activeProviders(): DetectorProvider[] {
  return allProviders.filter((p) => p.isConfigured() && isEnabled(p.id));
}

export * from "./types";
