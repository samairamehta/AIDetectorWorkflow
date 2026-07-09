export function SetupCard() {
  return (
    <div className="rounded-[24px] border border-line bg-surface p-8" style={{ animation: "dd-card-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
        One step left
      </p>
      <h2 className="mb-3 text-xl font-semibold tracking-tight">
        Add your Sapling API key to get started
      </h2>
      <p className="mb-6 max-w-xl text-sm leading-6 text-muted">
        DetectDeck needs a Sapling key to run detections. Get one from the
        Sapling dashboard under API Settings, then Generate Key. Trial keys
        include 50,000 characters per rolling 24 hours.
      </p>
      <ol className="mb-6 space-y-3 text-sm">
        {[
          <>Copy <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-xs">.env.example</code> to <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-xs">.env.local</code> in the project root.</>,
          <>Paste your key: <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-xs">SAPLING_API_KEY=sk_your_key</code></>,
          <>Restart the dev server with <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-xs">npm run dev</code> and refresh this page.</>,
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tealsoft font-mono text-xs font-semibold text-teal">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <a
        href="https://sapling.ai/docs/api/detector/"
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-teal underline-offset-4 hover:underline"
      >
        Sapling detector docs
      </a>
    </div>
  );
}
