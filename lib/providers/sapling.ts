import { labelForScore, MAX_CHARS_PER_REQUEST } from "../config";
import { resolveKey } from "./store";
import {
  DetectionResult,
  DetectorProvider,
  ProviderError,
  SentenceScore,
} from "./types";

const ENDPOINT = "https://api.sapling.ai/api/v1/aidetect";
const ENV_VAR = "SAPLING_API_KEY";
const TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

// A short sample used to validate a key without spending real quota on the
// user's content. Comfortably over the 150-char reliability floor.
const TEST_SAMPLE =
  "The committee met on Thursday to review the quarterly budget and approve " +
  "funding for the new community center, which is expected to open next spring.";

interface SaplingResponse {
  score: number;
  sentence_scores?: { score: number; sentence: string }[];
  text?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithTimeout(body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function callSapling(key: string, text: string): Promise<SaplingResponse> {
  const body = JSON.stringify({ key, text, sent_scores: true });
  let lastError: ProviderError | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    let res: Response;
    try {
      res = await postWithTimeout(body);
    } catch {
      lastError = new ProviderError(
        "Could not reach Sapling. Check your internet connection and try again.",
        "network"
      );
      continue; // network errors and timeouts are retryable
    }

    if (res.ok) {
      return (await res.json()) as SaplingResponse;
    }

    if (res.status === 401 || res.status === 403) {
      throw new ProviderError(
        "Sapling returned 401, your API key is invalid or expired, check .env.local",
        "auth"
      );
    }
    if (res.status === 429) {
      lastError = new ProviderError(
        "Sapling is rate limiting requests. Wait a moment and try again.",
        "rate_limit"
      );
      continue;
    }
    if (res.status >= 500) {
      lastError = new ProviderError(
        `Sapling returned a server error (${res.status}). Try again shortly.`,
        "server"
      );
      continue;
    }

    // Other 4xx: not retryable, surface Sapling's message if present.
    let detail = "";
    try {
      const parsed = (await res.json()) as { msg?: string };
      if (parsed.msg) detail = ` Sapling says: ${parsed.msg}`;
    } catch {
      // response body was not JSON, keep the generic message
    }
    throw new ProviderError(
      `Sapling rejected the request (${res.status}).${detail}`,
      "bad_request"
    );
  }

  throw lastError ?? new ProviderError("Sapling request failed.", "network");
}

export const saplingProvider: DetectorProvider = {
  id: "sapling",
  name: "Sapling",
  envVar: ENV_VAR,

  isConfigured() {
    return Boolean(resolveKey("sapling", ENV_VAR));
  },

  async testKey(key: string): Promise<void> {
    // callSapling throws a ProviderError on any failure (401, network, etc).
    await callSapling(key.trim(), TEST_SAMPLE);
  },

  async detect(text: string): Promise<DetectionResult> {
    const key = resolveKey("sapling", ENV_VAR);
    if (!key) {
      throw new ProviderError(
        "No Sapling key found. Add one in Settings or set SAPLING_API_KEY in .env.local.",
        "auth"
      );
    }
    if (text.length > MAX_CHARS_PER_REQUEST) {
      throw new ProviderError(
        `Text is ${text.length.toLocaleString()} characters. Sapling accepts at most ${MAX_CHARS_PER_REQUEST.toLocaleString()} per request.`,
        "bad_request"
      );
    }

    const data = await callSapling(key, text);
    const sentenceScores: SentenceScore[] | undefined = data.sentence_scores?.map(
      (s) => ({ sentence: s.sentence, score: s.score })
    );

    return {
      provider: "sapling",
      aiScore: data.score,
      label: labelForScore(data.score),
      sentenceScores,
      raw: data,
    };
  },
};
