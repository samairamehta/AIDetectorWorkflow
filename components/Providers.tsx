"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MotionConfig } from "motion/react";
import type { QuotaResponse } from "@/lib/types";

// ---------- Toasts ----------

export type ToastKind = "error" | "success" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  dragX: number;
}

interface ToastApi {
  push(kind: ToastKind, message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside Providers");
  return ctx;
}

// ---------- Quota ----------

interface QuotaApi {
  quota: QuotaResponse | null;
  refresh(): Promise<void>;
  apply(quota: QuotaResponse): void;
  // Characters queued on the Scan page, shown as the projected quota layer.
  pendingChars: number;
  setPendingChars(n: number): void;
}

const QuotaContext = createContext<QuotaApi | null>(null);

export function useQuota(): QuotaApi {
  const ctx = useContext(QuotaContext);
  if (!ctx) throw new Error("useQuota must be used inside Providers");
  return ctx;
}

// ---------- Toast card ----------

const TOAST_LIFETIME_MS = 4200;

function ToastCard({
  toast,
  onDragTo,
  onRelease,
  onDismiss,
}: {
  toast: Toast;
  onDragTo(id: number, dx: number): void;
  onRelease(id: number): void;
  onDismiss(id: number): void;
}) {
  const start = useRef<number | null>(null);

  const isError = toast.kind === "error";
  const iconColor = isError ? "var(--dd-crimson)" : "var(--dd-teal)";
  const iconSoft = isError ? "var(--dd-crimson-soft)" : "var(--dd-teal-soft)";

  return (
    <div style={{ pointerEvents: "auto", animation: "dd-toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>
      <div
        onPointerDown={(e) => {
          start.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current !== null) onDragTo(toast.id, e.clientX - start.current);
        }}
        onPointerUp={() => {
          start.current = null;
          // A plain click (no meaningful drag) dismisses the toast outright.
          if (Math.abs(toast.dragX) < 6) onDismiss(toast.id);
          else onRelease(toast.id);
        }}
        title="Dismiss"
        className="relative flex min-w-[250px] max-w-[320px] cursor-grab items-center gap-[11px] overflow-hidden rounded-xl border border-line bg-surface px-4 py-[13px] shadow-dd"
        style={{
          transform: `translateX(${toast.dragX}px)`,
          opacity: 1 - Math.min(0.85, Math.abs(toast.dragX) / 170),
          transition:
            toast.dragX !== 0
              ? "none"
              : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease",
          touchAction: "none",
        }}
        role={isError ? "alert" : "status"}
      >
        <span
          className="flex h-5 w-5 flex-none items-center justify-center rounded-full"
          style={{ background: iconSoft, color: iconColor }}
        >
          {isError ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          )}
        </span>
        <span className="flex-1 text-[13px] font-medium">{toast.message}</span>
        <span
          className="absolute bottom-0 left-0 right-0 h-[2px] origin-left"
          style={{
            background: iconColor,
            animation: `dd-timebar ${TOAST_LIFETIME_MS / 1000}s linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

// ---------- Provider ----------

export function Providers({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [pendingChars, setPendingChars] = useState(0);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => {
        // An identical toast already on screen is not shown twice. This
        // keeps a repeating failure from stacking an endless column.
        if (prev.some((t) => t.kind === kind && t.message === message)) return prev;
        return [...prev, { id, kind, message, dragX: 0 }];
      });
      setTimeout(() => dismiss(id), TOAST_LIFETIME_MS);
    },
    [dismiss]
  );

  const onDragTo = useCallback((id: number, dx: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, dragX: dx } : t)));
  }, []);

  const onRelease = useCallback(
    (id: number) => {
      setToasts((prev) => {
        const t = prev.find((x) => x.id === id);
        if (t && Math.abs(t.dragX) > 90) return prev.filter((x) => x.id !== id);
        return prev.map((x) => (x.id === id ? { ...x, dragX: 0 } : x));
      });
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/quota");
      if (res.ok) setQuota((await res.json()) as QuotaResponse);
    } catch {
      // nav quota bar just stays in its loading state
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!quota?.nextReleaseAt) return;
    const delay = Math.max(1_000, quota.nextReleaseAt - Date.now() + 1_000);
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timer);
  }, [quota?.nextReleaseAt, refresh]);

  // Context values must be referentially stable, otherwise every quota or
  // toast state change makes consumers see a "new" context and any effect
  // depending on it re-fires, which can loop fetches indefinitely.
  const toastApi = useMemo<ToastApi>(() => ({ push }), [push]);
  const quotaApi = useMemo<QuotaApi>(
    () => ({ quota, refresh, apply: setQuota, pendingChars, setPendingChars }),
    [quota, refresh, pendingChars]
  );

  return (
    <MotionConfig reducedMotion="user">
      <ToastContext.Provider value={toastApi}>
        <QuotaContext.Provider value={quotaApi}>
          {children}
          <div
            className="pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2.5"
            aria-live="polite"
          >
            {toasts.map((t) => (
              <ToastCard
                key={t.id}
                toast={t}
                onDragTo={onDragTo}
                onRelease={onRelease}
                onDismiss={dismiss}
              />
            ))}
          </div>
        </QuotaContext.Provider>
      </ToastContext.Provider>
    </MotionConfig>
  );
}
