// Shapes shared between API routes and client components.

import type { Label } from "./config";
import type { SentenceScore } from "./providers/types";

export type Verdict = "PASS" | "FLAG";

export interface DetectRequestText {
  id: string;
  title: string;
  content: string;
}

export interface ProviderOutcome {
  provider: string;
  providerName: string;
  ok: boolean;
  score?: number;
  label?: Label;
  sentenceScores?: SentenceScore[];
  error?: string;
}

export interface ScanOutcome {
  id: string; // client-supplied id, echoes back
  scanId: number | null; // SQLite row id, null if every provider failed
  title: string;
  chars: number;
  verdict: Verdict | null;
  shortText: boolean; // under the reliable minimum
  providers: ProviderOutcome[];
}

export interface DetectResponse {
  results: ScanOutcome[];
  quota: QuotaResponse;
}

export interface QuotaResponse {
  budget: number;
  used: number;
  remaining: number;
  nextReleaseAt: number | null;
}

export interface HistoryRow {
  scanId: number;
  createdAt: number;
  title: string;
  chars: number;
  verdict: Verdict;
  provider: string;
  score: number;
  label: Label;
  // Highest-scoring sentence from the stored sentence breakdown, if any.
  topSentence: string | null;
}

export interface HistoryResponse {
  rows: HistoryRow[];
}

export interface ProviderStatus {
  id: string;
  name: string;
  envVar: string;
  configured: boolean; // has a usable key (env or stored)
  enabled: boolean; // selected to run in scans
  source: "env" | "stored" | "none";
  hint: string;
}

export interface StatusResponse {
  providers: ProviderStatus[];
  saplingConfigured: boolean;
  passThreshold: number;
  thresholdSource: "settings" | "env";
}

export interface ApiError {
  error: string;
}
