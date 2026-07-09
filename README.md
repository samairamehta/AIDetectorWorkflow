# DetectDeck

A local QA tool that checks written content (press releases, blog posts, articles) against AI-detection APIs and reports whether the text scores as human-written.

DetectDeck **measures, reports, and tracks**. It never rewrites, paraphrases, or "humanizes" text.

## What it does

- Scans one or many texts (paste, or drop `.txt` / `.md` files) through every configured detector
- Shows a normalized 0 to 1 AI score, a human / mixed / ai label, and a PASS or FLAG verdict per text
- Highlights each sentence on a green-to-red scale so you can see exactly which sentences drag the score up
- Tracks a rolling 24 hour character budget and blocks scans that would exceed it
- Persists every scan to SQLite and exports history as CSV

## Setup (3 steps)

1. `npm install`
2. Copy `.env.example` to `.env.local` and paste your Sapling key into `SAPLING_API_KEY`
3. `npm run dev` and open http://localhost:3000

That is all. The database is created automatically at `./data/history.db` (gitignored).

### Where to get a Sapling key

Sign up at [sapling.ai](https://sapling.ai), open the dashboard, go to **API Settings**, and click **Generate Key**. Paste the 32 character key into `.env.local`.

Verify the key before opening the GUI:

```
npm run smoke-test
```

This sends one sample paragraph to Sapling and prints the score.

## The daily quota

Sapling trial developer keys allow **50,000 characters per rolling 24 hours** (and the trial key expires after one month). DetectDeck logs the character count of every request it sends and computes usage over the trailing 24 hours.

- The quota bar in the top nav shows used vs total, and turns amber above 80 percent
- Before any scan, DetectDeck checks the whole batch against the remaining budget. If it does not fit, the scan is blocked and the app tells you how many characters remain and when budget frees up
- Change the budget with `DAILY_CHAR_BUDGET` in `.env.local` if your plan allows more

## Pass threshold

A text passes when **every configured provider** scores below the pass threshold (default `0.2`). Set the default with `PASS_THRESHOLD` in `.env.local`, or edit it on the Settings page, which persists to SQLite and overrides the env value.

## Adding GPTZero or Pangram later

Providers live behind a common interface in `lib/providers/`. GPTZero and Pangram ship as stubs that show up grayed out in Settings. To enable one:

1. Add the key to `.env.local` (`GPTZERO_API_KEY=` or `PANGRAM_API_KEY=`)
2. Implement `detect()` in `lib/providers/gptzero.ts` or `lib/providers/pangram.ts` (each file has the endpoint, auth header, and response shape documented in a comment) and make `isConfigured()` check the env key
3. Restart the dev server. The provider joins every scan automatically, and the verdict requires it to pass too. No UI changes needed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run smoke-test` | Send one paragraph to Sapling and print the score |

## Notes

- API keys never reach the browser. All detector calls happen in Next.js API routes.
- Requests to Sapling retry up to 3 times with exponential backoff on network errors, 429, and 5xx, and time out at 30 seconds.
- Texts under 150 characters produce unreliable scores. The UI warns you but does not block the scan.
