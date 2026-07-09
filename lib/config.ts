// Central configuration. All env access lives here.

// Sapling label bounds: score below HUMAN_MAX reads as human,
// above AI_MIN as AI, anything between as mixed.
export const LABEL_HUMAN_MAX = 0.2;
export const LABEL_AI_MIN = 0.6;

// Sapling scores are unreliable under this many characters.
export const MIN_RELIABLE_CHARS = 150;

// Sapling hard limit per request.
export const MAX_CHARS_PER_REQUEST = 200_000;

export const DEFAULT_PASS_THRESHOLD = 0.2;
export const DEFAULT_DAILY_CHAR_BUDGET = 50_000;

export function envPassThreshold(): number {
  const raw = Number(process.env.PASS_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw <= 1
    ? raw
    : DEFAULT_PASS_THRESHOLD;
}

export function dailyCharBudget(): number {
  const raw = Number(process.env.DAILY_CHAR_BUDGET);
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_DAILY_CHAR_BUDGET;
}

export type Label = "human" | "mixed" | "ai";

export function labelForScore(score: number): Label {
  if (score < LABEL_HUMAN_MAX) return "human";
  if (score > LABEL_AI_MIN) return "ai";
  return "mixed";
}
