import { labelForScore } from "../config";
import { resolveKey } from "./store";
import {
  DetectionResult,
  DetectorProvider,
  ProviderError,
  SentenceScore,
} from "./types";

// GPTZero v2 synchronous text prediction.
//   POST https://api.gptzero.me/v2/predict/text
//   Header: x-api-key
//   Body:   { "document": "<text>" }
// The response nests results under `documents[0]`, with class_probabilities
// (ai / human / mixed) and a per-sentence breakdown.

const ENDPOINT = "https://api.gptzero.me/v2/predict/text";
const ENV_VAR = "GPTZERO_API_KEY";
const TIMEOUT_MS = 30_000;

const TEST_SAMPLE =
  "The committee met on Thursday to review the quarterly budget and approve " +
  "funding for the new community center, which is expected to open next spring.";

interface GptZeroDoc {
  class_probabilities?: { ai?: number; human?: number; mixed?: number };
  completely_generated_prob?: number;
  sentences?: { sentence?: string; text?: string; generated_prob?: number }[];
}
interface GptZeroResponse {
  documents?: GptZeroDoc[];
}

async function callGptZero(key: string, text: string): Promise<GptZeroDoc> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ document: text }),
      signal: controller.signal,
    });
  } catch {
    throw new ProviderError(
      "Could not reach GPTZero. Check your internet connection and try again.",
      "network"
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(
      "GPTZero returned 401, that API key is invalid or expired.",
      "auth"
    );
  }
  if (res.status === 429) {
    throw new ProviderError("GPTZero is rate limiting requests. Try again shortly.", "rate_limit");
  }
  if (!res.ok) {
    throw new ProviderError(`GPTZero rejected the request (${res.status}).`, "bad_request");
  }

  const data = (await res.json()) as GptZeroResponse;
  const doc = data.documents?.[0];
  if (!doc) {
    throw new ProviderError("GPTZero returned an unexpected response shape.", "bad_request");
  }
  return doc;
}

function aiScoreOf(doc: GptZeroDoc): number {
  if (typeof doc.class_probabilities?.ai === "number") return doc.class_probabilities.ai;
  if (typeof doc.completely_generated_prob === "number") return doc.completely_generated_prob;
  return 0;
}

export const gptzeroProvider: DetectorProvider = {
  id: "gptzero",
  name: "GPTZero",
  envVar: ENV_VAR,

  isConfigured() {
    return Boolean(resolveKey("gptzero", ENV_VAR));
  },

  async testKey(key: string): Promise<void> {
    await callGptZero(key.trim(), TEST_SAMPLE);
  },

  async detect(text: string): Promise<DetectionResult> {
    const key = resolveKey("gptzero", ENV_VAR);
    if (!key) {
      throw new ProviderError(
        "No GPTZero key found. Add one in Settings or set GPTZERO_API_KEY in .env.local.",
        "auth"
      );
    }
    const doc = await callGptZero(key, text);
    const aiScore = aiScoreOf(doc);
    const sentenceScores: SentenceScore[] | undefined = doc.sentences?.map((s) => ({
      sentence: s.sentence ?? s.text ?? "",
      score: s.generated_prob ?? 0,
    }));
    return {
      provider: "gptzero",
      aiScore,
      label: labelForScore(aiScore),
      sentenceScores,
      raw: doc,
    };
  },
};
