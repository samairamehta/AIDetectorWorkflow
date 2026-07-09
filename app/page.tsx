"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuota, useToast } from "@/components/Providers";
import { SetupCard } from "@/components/SetupCard";
import { AnimatedRing, VerdictChip } from "@/components/dd";
import { CountUp } from "@/components/motion-primitives";
import { MIN_RELIABLE_CHARS } from "@/lib/config";
import { verdictOf, verdictMeta, type Verdict3 } from "@/lib/verdict";
import type {
  ApiError,
  DetectResponse,
  ScanOutcome,
  StatusResponse,
} from "@/lib/types";

interface QueueItem {
  id: string;
  title: string;
  content: string;
  outcome?: ScanOutcome;
  flipDelayMs: number;
  accordionOpen: boolean;
}

type ScanPhase = "idle" | "analyzing" | "results";

let queueCounter = 0;

function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const words = clean.split(" ").slice(0, 6).join(" ");
  return words.length < clean.length ? `${words}…` : words || "Untitled document";
}

// Rolling odometer for the character count, straight from the design.
function Odometer({ value }: { value: number }) {
  const digits = String(value).split("");
  return (
    <div className="flex text-[13px] font-semibold text-ink">
      {digits.map((ch, i) => (
        <div key={`${digits.length}-${i}`} className="relative h-4 w-2 overflow-hidden">
          <div
            className="absolute left-0 top-0"
            style={{
              transition: "transform 0.42s cubic-bezier(0.65,0,0.35,1)",
              transform: `translateY(${-Number(ch) * 10}%)`,
            }}
          >
            {Array.from({ length: 10 }, (_, d) => (
              <div key={d} className="h-4 text-center">
                {d}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ScanPage() {
  const toast = useToast();
  const { quota, apply: applyQuota, refresh: refreshQuota, setPendingChars } = useQuota();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [pasteText, setPasteText] = useState("");
  const [dropHover, setDropHover] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState<{ itemId: string; idx: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data: StatusResponse) => setStatus(data))
      .catch(() =>
        toast.push("error", "Could not load app status. Is the dev server running?")
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threshold = status?.passThreshold ?? 0.2;
  const activeProviderCount = useMemo(
    () => status?.providers.filter((p) => p.configured && p.enabled).length ?? 1,
    [status]
  );

  const queuedInputChars = useMemo(
    () =>
      phase === "results" ? 0 : items.reduce((sum, it) => sum + it.content.length, 0),
    [items, phase]
  );
  // Queued detector characters feed the projected layer in the nav quota bar.
  const queuedDetectorChars = queuedInputChars * activeProviderCount;
  useEffect(() => {
    setPendingChars(queuedDetectorChars);
    return () => setPendingChars(0);
  }, [queuedDetectorChars, setPendingChars]);

  const addItem = useCallback(
    (title: string, content: string) => {
      const text = content.trim();
      if (!text) return;
      setItems((prev) => [
        ...prev.map((it) => ({ ...it, outcome: undefined, accordionOpen: false })),
        {
          id: `it-${++queueCounter}`,
          title: title || "Untitled document",
          content: text,
          flipDelayMs: 0,
          accordionOpen: false,
        },
      ]);
      setPhase("idle");
      toast.push("success", "Added to queue");
    },
    [toast]
  );

  const acceptFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        if (!/\.(txt|md|markdown)$/i.test(file.name)) {
          toast.push("error", `"${file.name}" was skipped. Only .txt and .md files are supported.`);
          continue;
        }
        const content = await file.text();
        if (!content.trim()) {
          toast.push("error", `"${file.name}" is empty and was skipped.`);
          continue;
        }
        addItem(file.name.replace(/\.[^.]+$/, ""), content);
      }
    },
    [addItem, toast]
  );

  const addPaste = useCallback(() => {
    const t = pasteText.trim();
    if (!t) return;
    addItem(deriveTitle(t), t);
    setPasteText("");
  }, [pasteText, addItem]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) =>
      prev
        .filter((it) => it.id !== id)
        .map((it) => ({ ...it, outcome: undefined, accordionOpen: false }))
    );
    setPhase("idle");
  }, []);

  const newScan = useCallback(() => {
    setItems([]);
    setPhase("idle");
  }, []);

  const overBudget = quota !== null && queuedDetectorChars > quota.remaining;

  const runDetection = useCallback(async () => {
    if (phase === "analyzing" || items.length === 0 || overBudget) return;
    setPhase("analyzing");
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: items.map(({ id, title, content }) => ({ id, title, content })),
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        toast.push("error", err.error || "Detection failed.");
        setPhase("idle");
        await refreshQuota();
        return;
      }
      const data = (await res.json()) as DetectResponse;
      const byId = new Map(data.results.map((r) => [r.id, r]));
      setItems((prev) =>
        prev.map((it, i) => ({
          ...it,
          outcome: byId.get(it.id),
          flipDelayMs: i * 130,
          accordionOpen: false,
        }))
      );
      setPhase("results");
      applyQuota(data.quota);
      const failures = data.results.flatMap((r) =>
        r.providers.filter((p) => !p.ok).map((p) => p.error ?? `${p.providerName} failed.`)
      );
      for (const message of Array.from(new Set(failures))) {
        toast.push("error", message);
      }
    } catch {
      toast.push("error", "Network problem while contacting the app. Try again.");
      setPhase("idle");
    }
  }, [phase, items, overBudget, toast, applyQuota, refreshQuota]);

  // Verdict per item from the primary provider score.
  const itemVerdict = useCallback(
    (it: QueueItem): { verdict: Verdict3; score: number } | null => {
      const primary = it.outcome?.providers.find((p) => p.ok);
      if (!primary || primary.score === undefined) return null;
      return { verdict: verdictOf(primary.score, threshold), score: primary.score };
    },
    [threshold]
  );

  const counts = useMemo(() => {
    const c = { pass: 0, mixed: 0, flag: 0 };
    if (phase !== "results") return c;
    for (const it of items) {
      const v = itemVerdict(it);
      if (v) c[v.verdict]++;
    }
    return c;
  }, [items, phase, itemVerdict]);

  const analyzing = phase === "analyzing";
  const showRun = items.length > 0 && phase !== "results";
  const runDisabled = analyzing || items.length === 0 || overBudget;

  if (status && !status.saplingConfigured) {
    return (
      <div className="mx-auto max-w-[860px] px-[30px] pb-16 pt-11" style={{ animation: "dd-fade-up 0.24s ease both" }}>
        <SetupCard />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[860px] px-[30px] pb-16 pt-11" style={{ animation: "dd-fade-up 0.24s ease both" }}>
      {/* Drop zone */}
      <div
        onMouseEnter={() => setDropHover(true)}
        onMouseLeave={() => setDropHover(false)}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          setDropHover(false);
          if (e.dataTransfer.files.length) void acceptFiles(e.dataTransfer.files);
          else {
            const t = e.dataTransfer.getData("text/plain");
            if (t) addItem("Pasted text", t);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className="relative flex cursor-pointer flex-col items-center gap-2 rounded-[24px] px-8 py-[50px] text-center"
        style={{
          background: dragOver ? "var(--dd-teal-soft)" : "transparent",
          transform: dragOver
            ? "translateY(-2px) scale(1.01)"
            : dropHover
              ? "translateY(-2px) scale(1.005)"
              : "none",
          transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1), background 0.25s ease",
        }}
      >
        <svg width="100%" height="100%" className="pointer-events-none absolute inset-0 overflow-visible">
          <rect
            x="0" y="0" width="100%" height="100%" rx="23" fill="none"
            stroke="var(--dd-border-strong)" strokeWidth="2" strokeDasharray="9 7"
            style={{
              animation: dragOver
                ? "dd-march 0.45s linear infinite"
                : dropHover
                  ? "dd-march 0.9s linear infinite"
                  : "none",
            }}
          />
        </svg>
        <div className="relative flex h-[46px] w-[46px] items-center justify-center rounded-full bg-surface2 text-teal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>
        </div>
        <div className="relative text-[15.5px] font-semibold">Drop a document, or paste it below</div>
        <div className="relative text-[12.5px] text-muted">Accepts .txt or .md, or click to browse</div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void acceptFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Paste area */}
      <div className="relative mt-[18px]">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Or paste the text you want to check for AI authorship..."
          className="min-h-[150px] w-full resize-y rounded-[20px] border border-line bg-surface px-[22px] pb-[46px] pt-[22px] font-serif text-[16.5px] leading-[1.75] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-teal focus:shadow-[0_0_0_3px_var(--dd-teal-soft)]"
        />
        <button
          onClick={addPaste}
          disabled={!pasteText.trim()}
          className="absolute bottom-[13px] left-[14px] whitespace-nowrap rounded-full border border-line bg-surface px-[13px] py-[7px] text-xs font-semibold transition-[opacity,border-color] duration-200 hover:border-teal"
          style={{
            color: pasteText.trim() ? "var(--dd-teal)" : "var(--dd-ink-faint)",
            cursor: pasteText.trim() ? "pointer" : "default",
            opacity: pasteText.trim() ? 1 : 0.6,
          }}
        >
          Add to queue
        </button>
        <div className="pointer-events-none absolute bottom-4 right-4 flex items-baseline gap-[5px]">
          <Odometer value={pasteText.length} />
          <span className="text-[10.5px] font-medium text-faint">characters</span>
        </div>
      </div>

      {/* Summary bar */}
      {phase === "results" && (
        <div className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-surface px-[22px] py-4 text-sm">
          <span className="font-medium">
            <CountUp value={items.length} from={0} duration={0.75} className="font-bold tabular-nums" /> texts scanned
          </span>
          <span className="h-[15px] w-px bg-line" />
          <span className="font-semibold text-teal">
            <CountUp value={counts.pass} from={0} duration={0.75} className="tabular-nums" /> passed
          </span>
          {counts.mixed > 0 && (
            <span className="font-semibold text-amber">
              <CountUp value={counts.mixed} from={0} duration={0.75} className="tabular-nums" /> mixed
            </span>
          )}
          {counts.flag > 0 && (
            <span className="font-semibold text-crimson">
              <CountUp value={counts.flag} from={0} duration={0.75} className="tabular-nums" /> flagged
            </span>
          )}
        </div>
      )}

      {/* Queue / results */}
      {items.length > 0 && (
        <>
          <div className="mb-3 mt-[26px] flex items-center justify-between">
            <div className="flex items-center gap-[9px]">
              <span className="text-xs font-semibold uppercase tracking-[0.07em] text-muted">
                {phase === "results" ? "Results" : "Queue"}
              </span>
              <span className="rounded-full bg-surface2 px-2 py-[2px] text-[11px] font-semibold tabular-nums text-muted">
                {items.length}
              </span>
            </div>
            {phase === "results" && (
              <button
                onClick={newScan}
                className="whitespace-nowrap rounded-full border border-line px-[15px] py-[7px] text-[12.5px] font-semibold text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink"
              >
                New scan
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {items.map((it, i) => {
              const v = itemVerdict(it);
              const primary = it.outcome?.providers.find((p) => p.ok);
              const failed = it.outcome && !primary;
              const flipped = Boolean(it.outcome);
              const short = it.content.length < MIN_RELIABLE_CHARS;
              return (
                <div
                  key={it.id}
                  className="flex flex-col"
                  style={{ animation: "dd-card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both", animationDelay: `${i * 60}ms` }}
                >
                  <div className="relative h-24" style={{ perspective: 1500 }}>
                    <div
                      className="absolute inset-0"
                      style={{
                        transformStyle: "preserve-3d",
                        transition: "transform 0.55s cubic-bezier(0.5,0.04,0.3,1)",
                        transitionDelay: `${it.flipDelayMs}ms`,
                        transform: `rotateX(${flipped ? 180 : 0}deg)`,
                      }}
                    >
                      {/* Front: queued */}
                      <div
                        className="absolute inset-0 flex items-center gap-[15px] rounded-2xl border border-line bg-surface px-5"
                        style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                      >
                        <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-surface2 text-muted">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M15 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z" /><path d="M9 13h6M9 17h4" /></svg>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                          <input
                            value={it.title}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((q) => (q.id === it.id ? { ...q, title: e.target.value } : q))
                              )
                            }
                            aria-label="Title"
                            className="-ml-[5px] w-full rounded-md border-none bg-transparent px-[5px] py-[3px] text-[14.5px] font-semibold text-ink outline-none transition-colors duration-150 focus:bg-surface2"
                          />
                          <span className="text-xs text-muted">Ready to scan</span>
                        </div>
                        {short && (
                          <span
                            className="flex-none rounded-full bg-ambersoft px-[9px] py-1 text-[11px] font-semibold text-amber"
                            style={{ animation: "dd-badge-pulse 0.62s ease 2" }}
                            title={`Under ${MIN_RELIABLE_CHARS} characters, the score may be unreliable`}
                          >
                            Short
                          </span>
                        )}
                        <span className="flex-none rounded-full bg-surface2 px-[11px] py-[5px] text-[11.5px] tabular-nums text-muted">
                          {it.content.length.toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeItem(it.id)}
                          aria-label="Remove"
                          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg text-faint transition-colors duration-150 hover:bg-surface2 hover:text-ink"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {/* Back: result */}
                      <div
                        className="absolute inset-0 flex items-center gap-4 rounded-2xl border border-line bg-surface px-5"
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "rotateX(180deg)",
                        }}
                      >
                        {flipped && v && primary && (
                          <>
                            <AnimatedRing
                              size={64}
                              r={26}
                              stroke={5}
                              color={verdictMeta(v.verdict).color}
                              score={v.score}
                              delayMs={it.flipDelayMs + 560}
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-semibold">
                                {it.title}
                              </span>
                              <span className="text-xs text-muted">
                                {primary.providerName} &middot; {it.content.length.toLocaleString()} characters
                              </span>
                            </div>
                            <VerdictChip verdict={v.verdict} stampDelayMs={it.flipDelayMs + 540} />
                            {primary.sentenceScores && primary.sentenceScores.length > 0 && (
                              <button
                                onClick={() =>
                                  setItems((prev) =>
                                    prev.map((q) =>
                                      q.id === it.id ? { ...q, accordionOpen: !q.accordionOpen } : q
                                    )
                                  )
                                }
                                className="flex flex-none items-center gap-[6px] whitespace-nowrap rounded-full border border-line px-[14px] py-[7px] text-[12.5px] font-medium text-muted transition-colors duration-150 hover:bg-surface2 hover:text-ink"
                              >
                                <span>{it.accordionOpen ? "Hide breakdown" : "See sentence breakdown"}</span>
                                <span className="flex transition-transform duration-200" style={{ transform: `rotate(${it.accordionOpen ? 180 : 0}deg)` }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </span>
                              </button>
                            )}
                          </>
                        )}
                        {flipped && failed && (
                          <>
                            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full border border-line text-xs text-faint">
                              &ndash;
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-semibold">
                                {it.title}
                              </span>
                              <span className="text-xs text-crimson">
                                {it.outcome?.providers.find((p) => !p.ok)?.error ?? "Detection failed."}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Sentence breakdown accordion */}
                  {flipped && primary?.sentenceScores && (
                    <div
                      className="grid transition-[grid-template-rows] duration-300 ease-out"
                      style={{ gridTemplateRows: it.accordionOpen ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-1 px-5 pb-[6px] pt-4">
                          <div className="font-serif text-[16.5px] leading-[1.95] text-ink">
                            {primary.sentenceScores.map((s, si) => {
                              const hue = Math.round(150 * (1 - s.score));
                              const hov = hovered?.itemId === it.id && hovered.idx === si;
                              const col = `hsla(${hue},70%,48%,${hov ? 0.52 : 0.3})`;
                              return (
                                <span
                                  key={si}
                                  onMouseEnter={() => setHovered({ itemId: it.id, idx: si })}
                                  onMouseLeave={() => setHovered(null)}
                                  className="relative inline cursor-default rounded-[3px]"
                                  style={{
                                    backgroundImage: `linear-gradient(${col},${col})`,
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "left center",
                                    backgroundSize: `${it.accordionOpen ? 100 : 0}% 86%`,
                                    transition: `background-size 0.3s ease ${si * 40}ms, background-image 0.2s ease`,
                                  }}
                                >
                                  <span
                                    className="pointer-events-none absolute bottom-full left-0 z-[5] mb-[5px] whitespace-nowrap rounded-md px-2 py-[3px] font-sans text-[11px] font-semibold shadow-dd transition-opacity duration-150"
                                    style={{
                                      background: "var(--dd-ink)",
                                      color: "var(--dd-bg)",
                                      opacity: hov ? 1 : 0,
                                    }}
                                  >
                                    {Math.round(s.score * 100)}% AI likelihood
                                  </span>
                                  {s.sentence}{" "}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Run button */}
      {showRun && (
        <>
          <button
            onClick={() => void runDetection()}
            disabled={runDisabled}
            className="relative mt-4 h-[54px] w-full overflow-hidden rounded-2xl border-none text-[14.5px] font-semibold text-white transition-[background,opacity,transform,box-shadow] duration-200 hover:shadow-[0_0_0_5px_var(--dd-teal-soft)] active:scale-[0.985]"
            style={{
              background: runDisabled && !analyzing ? "var(--dd-border-strong)" : "var(--dd-teal)",
              cursor: runDisabled ? "default" : "pointer",
              opacity: analyzing ? 0.9 : 1,
            }}
          >
            <span
              className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-200"
              style={{ opacity: analyzing ? 0 : 1 }}
            >
              <span>Run detection</span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-200"
              style={{ opacity: analyzing ? 1 : 0 }}
            >
              <span>Analyzing</span>
            </span>
            {analyzing && (
              <span
                className="absolute bottom-0 left-0 top-0 w-[34%]"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                  animation: "dd-sweep 1.15s linear infinite",
                }}
              />
            )}
          </button>
          {overBudget && quota && (
            <p className="mt-2 text-center text-[12.5px] text-crimson">
              This batch needs {queuedDetectorChars.toLocaleString()} detector characters but only{" "}
              {quota.remaining.toLocaleString()} remain in the daily budget.
            </p>
          )}
        </>
      )}
    </div>
  );
}
