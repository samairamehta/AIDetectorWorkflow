// Verifies the Sapling key works before opening the GUI.
// Usage: npm run smoke-test
// Reads SAPLING_API_KEY from the environment or .env.local.

import fs from "node:fs";
import path from "node:path";

function loadEnvLocal(): void {
  // Same precedence as Next.js: .env.local wins over .env.
  for (const name of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

const SAMPLE =
  "The city council voted on Tuesday to expand the riverside greenway by " +
  "two miles, a project residents have pushed for since the 2019 floods. " +
  "Funding comes from a mix of state grants and a local bond measure that " +
  "passed narrowly last fall. Construction is expected to begin in March " +
  "and wrap up before the end of next year, weather permitting.";

async function main(): Promise<void> {
  loadEnvLocal();
  const key = process.env.SAPLING_API_KEY?.trim();
  if (!key || key === "your_key_here") {
    console.error(
      "SAPLING_API_KEY is not set. Copy .env.example to .env.local and paste your key."
    );
    process.exit(1);
  }

  console.log("Sending a sample paragraph to Sapling...");
  const res = await fetch("https://api.sapling.ai/api/v1/aidetect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, text: SAMPLE, sent_scores: true }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401 || res.status === 403) {
    console.error(
      "Sapling returned 401, your API key is invalid or expired, check .env.local"
    );
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Sapling returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = (await res.json()) as {
    score: number;
    sentence_scores?: { score: number; sentence: string }[];
  };
  console.log(`\nOverall AI score: ${data.score.toFixed(4)} (0 = human, 1 = AI)`);
  if (data.sentence_scores) {
    console.log(`Sentence scores (${data.sentence_scores.length} sentences):`);
    for (const s of data.sentence_scores) {
      const preview = s.sentence.length > 60 ? `${s.sentence.slice(0, 60)}...` : s.sentence;
      console.log(`  ${s.score.toFixed(3)}  ${preview}`);
    }
  }
  console.log("\nYour key works. Run npm run dev and open http://localhost:3000");
}

main().catch((err: unknown) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
