// Three-way display verdict from the design: a score below the pass
// threshold passes, a score well above it flags, the band between reads
// as mixed. The stored PASS/FLAG verdict in SQLite stays authoritative;
// this is presentation logic only.

export type Verdict3 = "pass" | "mixed" | "flag";

export const FLAG_BAND = 0.35;

export function verdictOf(score: number, threshold: number): Verdict3 {
  const flagAt = Math.min(0.98, threshold + FLAG_BAND);
  if (score < threshold) return "pass";
  if (score >= flagAt) return "flag";
  return "mixed";
}

export interface VerdictMeta {
  label: string;
  color: string;
  soft: string;
}

export function verdictMeta(v: Verdict3): VerdictMeta {
  if (v === "pass")
    return { label: "PASS", color: "var(--dd-teal)", soft: "var(--dd-teal-soft)" };
  if (v === "flag")
    return { label: "FLAG", color: "var(--dd-crimson)", soft: "var(--dd-crimson-soft)" };
  return { label: "MIXED", color: "var(--dd-amber)", soft: "var(--dd-amber-soft)" };
}

// Compact character counts for the quota readout, "12.4k" style.
export function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}
