"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useQuota, useToast } from "@/components/Providers";
import { Ring } from "@/components/dd";
import { ProviderIcon, PROVIDER_BRAND } from "@/components/ProviderIcon";
import { verdictOf, verdictMeta, compact } from "@/lib/verdict";
import { FONT_OPTIONS, DEFAULT_FONT, fontValue } from "@/lib/fonts";
import type { ApiError, ProviderStatus, StatusResponse } from "@/lib/types";

const DESCRIPTIONS: Record<string, string> = {
  sapling: "Sentence-level AI detection tuned for marketing and PR copy.",
  gptzero: "Popular classifier using burstiness and perplexity signals.",
  pangram: "High-precision detection for long-form editorial content.",
};

// Live countdown to when the oldest usage rolls out of the 24 hour window.
function ResetCountdown({ nextReleaseAt }: { nextReleaseAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!nextReleaseAt) {
    return <span className="text-xs text-faint">Nothing used in the last 24 hours</span>;
  }
  const ms = Math.max(0, nextReleaseAt - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <span className="mt-1 inline-flex w-fit items-center gap-[7px] rounded-full bg-surface2 px-[10px] py-[5px]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--dd-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
      <span className="text-[11px] font-medium text-muted">Frees up in</span>
      <span className="text-[11.5px] font-semibold tabular-nums text-ink">
        {h}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
      </span>
    </span>
  );
}

// Small on/off switch for selecting a provider into scans.
function Switch({ on, onChange }: { on: boolean; onChange(v: boolean): void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative h-[22px] w-[38px] flex-none rounded-full transition-colors duration-200"
      style={{ background: on ? "var(--dd-teal)" : "var(--dd-border-strong)" }}
    >
      <motion.span
        className="absolute top-[3px] h-4 w-4 rounded-full bg-white shadow"
        animate={{ left: on ? 19 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}

type ModalPhase = "idle" | "testing" | "success" | "error";

function ConnectModal({
  provider,
  onClose,
  onConnected,
}: {
  provider: ProviderStatus;
  onClose(): void;
  onConnected(): void;
}) {
  const [key, setKey] = useState("");
  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const brand = PROVIDER_BRAND[provider.id] ?? { tint: "var(--dd-teal)", soft: "var(--dd-teal-soft)" };

  useEffect(() => {
    setMounted(true);
  }, []);

  const test = useCallback(async () => {
    if (!key.trim() || phase === "testing") return;
    setPhase("testing");
    setError("");
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: provider.id, key }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        setError(err.error || "That key did not pass the test.");
        setPhase("error");
        return;
      }
      setPhase("success");
      // Let the success animation play, then hand back to the page.
      setTimeout(onConnected, 1400);
    } catch {
      setError("Network problem while testing. Try again.");
      setPhase("error");
    }
  }, [key, phase, provider.id, onConnected]);

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center p-6"
      style={{ background: "rgba(20,20,18,0.5)", animation: "dd-fade-up 0.2s ease both" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-full overflow-hidden rounded-[20px] border border-line bg-surface p-[26px] shadow-dd"
        style={{ animation: "dd-card-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <div className="mb-[14px] flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ background: brand.soft, color: brand.tint }}
          >
            <ProviderIcon id={provider.id} size={18} />
          </div>
          <div className="text-base font-semibold">Connect {provider.name}</div>
        </div>

        <AnimatePresence mode="wait">
          {phase === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "var(--dd-teal-soft)", color: "var(--dd-teal)" }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path
                    d="M20 6 9 17l-5-5"
                    pathLength={1}
                    strokeDasharray={1}
                    initial={{ strokeDashoffset: 1 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
              </div>
              <div className="text-[15px] font-semibold">Key added. {provider.name} is live.</div>
              <div className="text-[13px] text-muted">
                You can use it in scans and select it on and off below.
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="mb-4 text-[13px] leading-[1.55] text-muted">
                Paste a {provider.name} API key. DetectDeck sends one short sample to
                verify it, then stores it locally in SQLite. It never reaches the browser.
              </p>
              <input
                type="password"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  if (phase === "error") setPhase("idle");
                }}
                onKeyDown={(e) => e.key === "Enter" && void test()}
                placeholder="Paste key, e.g. sk-..."
                disabled={phase === "testing"}
                autoFocus
                className="mb-3 w-full rounded-[11px] border border-line bg-paper px-[14px] py-[11px] font-mono text-[13px] text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-teal focus:shadow-[0_0_0_3px_var(--dd-teal-soft)]"
              />

              <AnimatePresence>
                {phase === "error" && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 overflow-hidden text-[12.5px] text-crimson"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-end gap-[10px]">
                <button
                  onClick={onClose}
                  className="rounded-[10px] border border-line px-4 py-[9px] text-[13px] font-semibold text-muted transition-colors duration-150 hover:bg-surface2"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void test()}
                  disabled={!key.trim() || phase === "testing"}
                  className="relative flex items-center justify-center gap-2 overflow-hidden rounded-[10px] px-[18px] py-[9px] text-[13px] font-semibold text-white transition-opacity duration-150"
                  style={{
                    background: "var(--dd-teal)",
                    opacity: !key.trim() ? 0.5 : 1,
                    cursor: !key.trim() || phase === "testing" ? "default" : "pointer",
                    minWidth: 148,
                  }}
                >
                  {phase === "testing" ? (
                    <>
                      <span className="h-[14px] w-[14px] animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      <span>Testing key</span>
                    </>
                  ) : (
                    "Test and connect"
                  )}
                  {phase === "testing" && (
                    <span
                      className="absolute bottom-0 left-0 top-0 w-1/3"
                      style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                        animation: "dd-sweep 1.15s linear infinite",
                      }}
                    />
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { quota, refresh: refreshQuota } = useQuota();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [threshold, setThreshold] = useState(0.2);
  const [modal, setModal] = useState<ProviderStatus | null>(null);
  const [font, setFont] = useState(DEFAULT_FONT);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const data = (await res.json()) as StatusResponse;
      setStatus(data);
      setThreshold(data.passThreshold);
    } catch {
      toast.push("error", "Could not load settings.");
    }
  }, [toast]);

  useEffect(() => {
    void loadStatus();
    void refreshQuota();
    try {
      const saved = localStorage.getItem("dd-font");
      if (saved) setFont(saved);
    } catch {
      // no persisted font, keep default
    }
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseFont = useCallback((id: string) => {
    setFont(id);
    document.documentElement.style.setProperty("--font-ui", fontValue(id));
    try {
      localStorage.setItem("dd-font", id);
    } catch {
      // font choice just will not persist
    }
  }, []);

  const persistThreshold = useCallback(
    (value: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passThreshold: value }),
          });
          if (!res.ok) {
            const err = (await res.json()) as ApiError;
            toast.push("error", err.error || "Could not save the threshold.");
            return;
          }
        } catch {
          toast.push("error", "Network problem while saving. Try again.");
        }
      }, 400);
    },
    [toast]
  );

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const r = track.getBoundingClientRect();
      let p = (clientX - r.left) / r.width;
      p = Math.max(0.02, Math.min(0.9, p));
      const value = Math.round(p * 100) / 100;
      setThreshold(value);
      persistThreshold(value);
    },
    [persistThreshold]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) updateFromPointer(e.clientX);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateFromPointer]);

  const toggleEnabled = useCallback(
    async (p: ProviderStatus, enabled: boolean) => {
      // Optimistic, the status reloads on failure.
      setStatus((prev) =>
        prev
          ? { ...prev, providers: prev.providers.map((x) => (x.id === p.id ? { ...x, enabled } : x)) }
          : prev
      );
      try {
        const res = await fetch("/api/providers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, enabled }),
        });
        if (!res.ok) throw new Error();
      } catch {
        toast.push("error", `Could not update ${p.name}.`);
        void loadStatus();
      }
    },
    [toast, loadStatus]
  );

  const disconnect = useCallback(
    async (p: ProviderStatus) => {
      try {
        const res = await fetch(`/api/providers?id=${p.id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          toast.push("error", err.error || `Could not disconnect ${p.name}.`);
          return;
        }
        toast.push("success", `${p.name} disconnected.`);
        void loadStatus();
      } catch {
        toast.push("error", `Could not disconnect ${p.name}.`);
      }
    },
    [toast, loadStatus]
  );

  const usedPct = quota && quota.budget > 0 ? Math.min(100, (quota.used / quota.budget) * 100) : 0;
  const over = usedPct > 80;
  const exampleScore = 0.42;
  const exampleMeta = verdictMeta(verdictOf(exampleScore, threshold));

  return (
    <div className="mx-auto flex max-w-[920px] flex-col gap-11 px-[30px] pb-16 pt-11" style={{ animation: "dd-fade-up 0.24s ease both" }}>
      <div>
        <h1 className="mb-[5px] text-[26px] font-semibold tracking-[-0.02em]">Settings</h1>
        <p className="text-[13.5px] text-muted">
          Configure detection providers, appearance, thresholds, and usage.
        </p>
      </div>

      {/* Providers */}
      <section>
        <h2 className="mb-1 text-[15px] font-semibold">Detection providers</h2>
        <p className="mb-[18px] text-[13px] text-muted">
          Connect the APIs DetectDeck queries when scanning. Toggle a connected
          provider to select whether it runs.
        </p>
        {!status ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-44 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {status.providers.map((p) => {
              const brand = PROVIDER_BRAND[p.id] ?? { tint: "var(--dd-teal)", soft: "var(--dd-teal-soft)" };
              const connected = p.configured;
              return (
                <div
                  key={p.id}
                  onClick={() => { if (!connected) setModal(p); }}
                  className="flex flex-col gap-[14px] rounded-[18px] border bg-surface p-5 transition-[opacity,border-color] duration-200"
                  style={{
                    opacity: connected ? 1 : 0.62,
                    cursor: connected ? "default" : "pointer",
                    borderColor: connected ? brand.soft : "var(--dd-border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]"
                      style={{ background: brand.soft, color: brand.tint }}
                    >
                      <ProviderIcon id={p.id} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-semibold">{p.name}</div>
                      <div className="mt-[3px] flex items-center gap-[6px]">
                        <span
                          className="h-[7px] w-[7px] flex-none rounded-full"
                          style={{
                            background: connected ? brand.tint : "var(--dd-ink-faint)",
                            animation: connected && p.enabled ? "dd-breathe 2.6s ease-in-out infinite" : "none",
                          }}
                        />
                        <span className="text-xs text-muted">
                          {!connected
                            ? "Not connected"
                            : p.enabled
                              ? p.source === "env"
                                ? "Connected via env"
                                : "Connected"
                              : "Connected, not selected"}
                        </span>
                      </div>
                    </div>
                    {connected && (
                      <Switch on={p.enabled} onChange={(v) => void toggleEnabled(p, v)} />
                    )}
                  </div>
                  <p className="text-[12.5px] leading-[1.5] text-muted">{DESCRIPTIONS[p.id]}</p>
                  {!connected ? (
                    <span className="text-[11.5px] font-semibold" style={{ color: brand.tint }}>
                      Add key to enable
                    </span>
                  ) : p.source === "stored" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void disconnect(p);
                      }}
                      className="w-fit text-[11.5px] font-medium text-faint transition-colors duration-150 hover:text-crimson"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <span className="text-[11.5px] text-faint">Key from {p.envVar}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Appearance */}
      <section>
        <h2 className="mb-1 text-[15px] font-semibold">Appearance</h2>
        <p className="mb-[18px] text-[13px] text-muted">
          Choose the interface font. Your reading text stays in its serif.
        </p>
        <div className="flex flex-wrap gap-3">
          {FONT_OPTIONS.map((f) => {
            const active = font === f.id;
            return (
              <button
                key={f.id}
                onClick={() => chooseFont(f.id)}
                className="flex min-w-[132px] flex-col items-start gap-1 rounded-[14px] border bg-surface px-4 py-3 text-left transition-colors duration-150"
                style={{
                  borderColor: active ? "var(--dd-teal)" : "var(--dd-border)",
                  boxShadow: active ? "0 0 0 3px var(--dd-teal-soft)" : "none",
                }}
              >
                <span
                  className="text-[19px] leading-none"
                  style={{ fontFamily: f.value, fontStyle: f.kind === "serif" ? "italic" : "normal" }}
                >
                  Aa
                </span>
                <span className="text-[12px] font-medium text-muted">{f.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Threshold */}
      <section>
        <h2 className="mb-1 text-[15px] font-semibold">Detection threshold</h2>
        <p className="mb-7 max-w-[520px] text-[13px] leading-[1.5] text-muted">
          Content scoring below this line passes. Scores above it are flagged for
          review. Drag to move the boundary, it saves automatically.
        </p>
        <div className="flex flex-wrap items-center gap-11">
          <div className="relative min-w-[260px] flex-1 pt-10">
            <div
              className="absolute top-[2px] whitespace-nowrap rounded-lg px-[9px] py-1 text-xs font-bold tabular-nums"
              style={{ left: `${threshold * 100}%`, transform: "translateX(-50%)", background: "var(--dd-ink)", color: "var(--dd-bg)" }}
            >
              {threshold.toFixed(2)}
            </div>
            <div
              ref={trackRef}
              onPointerDown={(e) => {
                dragging.current = true;
                updateFromPointer(e.clientX);
              }}
              className="relative h-[10px] cursor-pointer rounded-full"
              style={{ background: "linear-gradient(90deg, var(--dd-teal), var(--dd-amber) 60%, var(--dd-crimson))", touchAction: "none" }}
              role="slider"
              aria-label="Pass threshold"
              aria-valuemin={0.02}
              aria-valuemax={0.9}
              aria-valuenow={threshold}
            >
              <div
                className="absolute top-1/2 h-5 w-5 cursor-grab rounded-full bg-surface shadow-dd"
                style={{ left: `${threshold * 100}%`, margin: "-10px 0 0 -10px", border: "3px solid var(--dd-ink)" }}
              />
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-faint">
              <span>0.00 &middot; human</span>
              <span>AI &middot; 1.00</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-[10px]">
            <Ring size={72} r={30} stroke={6} color={exampleMeta.color} progress={exampleScore} label="42" labelSize={16} />
            <span
              className="rounded-[7px] px-[9px] py-1 text-[10.5px] font-bold tracking-[0.04em] transition-colors duration-300"
              style={{ background: exampleMeta.soft, color: exampleMeta.color }}
            >
              {exampleMeta.label}
            </span>
            <span className="text-[11px] text-faint">Example, score 0.42</span>
          </div>
        </div>
      </section>

      {/* Usage */}
      <section>
        <h2 className="mb-1 text-[15px] font-semibold">Usage this cycle</h2>
        <p className="mb-[18px] text-[13px] text-muted">
          Characters sent to detectors in the rolling 24 hour window.
        </p>
        {!quota ? (
          <div className="skeleton h-36 w-full max-w-[440px]" />
        ) : (
          <div className="flex max-w-[440px] items-center gap-[26px] rounded-[18px] border border-line bg-surface px-[26px] py-[22px]">
            <Ring size={104} r={46} stroke={8} color={over ? "var(--dd-amber)" : "var(--dd-teal)"} progress={usedPct / 100} label={String(Math.round(usedPct))} labelSize={20} />
            <div className="flex flex-col gap-[5px]">
              <span className="text-[22px] font-semibold tabular-nums">
                {compact(quota.used)} / {compact(quota.budget)}
              </span>
              <span className="text-[13px] text-muted">characters used</span>
              <ResetCountdown nextReleaseAt={quota.nextReleaseAt} />
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {modal && (
          <ConnectModal
            provider={modal}
            onClose={() => setModal(null)}
            onConnected={() => {
              setModal(null);
              toast.push("success", `${modal.name} connected and selected.`);
              void loadStatus();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
