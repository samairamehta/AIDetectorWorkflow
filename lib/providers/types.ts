import type { Label } from "../config";

export interface SentenceScore {
  sentence: string;
  score: number;
}

export interface DetectionResult {
  provider: string;
  aiScore: number; // normalized 0-1, higher = more AI-like
  label: Label;
  sentenceScores?: SentenceScore[];
  raw: unknown; // full raw API response
}

export interface DetectorProvider {
  id: string;
  name: string;
  // Env var this provider reads its key from (also the label shown in the UI).
  envVar: string;
  isConfigured(): boolean;
  detect(text: string): Promise<DetectionResult>;
  // Validate a candidate key with a small live request. Resolves on success,
  // throws a ProviderError on failure. Used by the "Add key" flow.
  testKey(key: string): Promise<void>;
}

// Thrown by providers so routes can surface plain-language messages.
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth" | "rate_limit" | "network" | "server" | "bad_request"
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
