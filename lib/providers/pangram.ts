import { labelForScore } from "../config";
import { resolveKey } from "./store";
import { DetectionResult, DetectorProvider, ProviderError } from "./types";

// Pangram async task API.
//   POST https://text.external-api.pangram.com/task  (header x-api-key, body { text })
// The request may return `fraction_ai` directly, or a task handle to poll.
// This is implemented best-effort against the documented shape; both the
// immediate and polled paths are handled defensively.

const ENDPOINT = "https://text.external-api.pangram.com/task";
const ENV_VAR = "PANGRAM_API_KEY";
const TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_500;
const MAX_POLLS = 20;

const TEST_SAMPLE =
  "The committee met on Thursday to review the quarterly budget and approve " +
  "funding for the new community center, which is expected to open next spring.";

interface PangramResponse {
  fraction_ai?: number;
  status?: string;
  task_id?: string;
  id?: string;
  result?: { fraction_ai?: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(
  key: string,
  init: RequestInit,
  url = ENDPOINT
): Promise<PangramResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "x-api-key": key, ...init.headers },
      signal: controller.signal,
    });
  } catch {
    throw new ProviderError(
      "Could not reach Pangram. Check your internet connection and try again.",
      "network"
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new ProviderError("Pangram returned 401, that API key is invalid or expired.", "auth");
  }
  if (res.status === 429) {
    throw new ProviderError("Pangram is rate limiting requests. Try again shortly.", "rate_limit");
  }
  if (!res.ok) {
    throw new ProviderError(`Pangram rejected the request (${res.status}).`, "bad_request");
  }
  return (await res.json()) as PangramResponse;
}

function fractionOf(r: PangramResponse): number | undefined {
  if (typeof r.fraction_ai === "number") return r.fraction_ai;
  if (typeof r.result?.fraction_ai === "number") return r.result.fraction_ai;
  return undefined;
}

async function runPangram(key: string, text: string): Promise<number> {
  const submitted = await request(key, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

  const immediate = fractionOf(submitted);
  if (immediate !== undefined) return immediate;

  // Poll the task until it resolves.
  const taskId = submitted.task_id ?? submitted.id;
  if (!taskId) {
    throw new ProviderError("Pangram returned neither a score nor a task id.", "bad_request");
  }
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const polled = await request(key, { method: "GET" }, `${ENDPOINT}/${taskId}`);
    const frac = fractionOf(polled);
    if (frac !== undefined) return frac;
    if (polled.status && /fail|error/i.test(polled.status)) {
      throw new ProviderError("Pangram reported the task failed.", "server");
    }
  }
  throw new ProviderError("Pangram timed out before returning a score.", "server");
}

export const pangramProvider: DetectorProvider = {
  id: "pangram",
  name: "Pangram",
  envVar: ENV_VAR,

  isConfigured() {
    return Boolean(resolveKey("pangram", ENV_VAR));
  },

  async testKey(key: string): Promise<void> {
    await runPangram(key.trim(), TEST_SAMPLE);
  },

  async detect(text: string): Promise<DetectionResult> {
    const key = resolveKey("pangram", ENV_VAR);
    if (!key) {
      throw new ProviderError(
        "No Pangram key found. Add one in Settings or set PANGRAM_API_KEY in .env.local.",
        "auth"
      );
    }
    const aiScore = await runPangram(key, text);
    return {
      provider: "pangram",
      aiScore,
      label: labelForScore(aiScore),
      raw: { fraction_ai: aiScore },
    };
  },
};
