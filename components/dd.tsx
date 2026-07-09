"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { verdictMeta, type Verdict3 } from "@/lib/verdict";

// Score ring used across scan results, history rows, and settings.
export function Ring({
  size,
  r,
  stroke,
  color,
  progress,
  label,
  labelSize = 15,
}: {
  size: number;
  r: number;
  stroke: number;
  color: string;
  progress: number; // 0-1
  label: string;
  labelSize?: number;
}) {
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--dd-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          style={{ transition: "stroke 0.4s ease, stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-bold tabular-nums"
        style={{ fontSize: labelSize }}
      >
        {label}
        <span style={{ fontSize: "0.6em", fontWeight: 600, opacity: 0.65, marginLeft: 0.5 }}>%</span>
      </div>
    </div>
  );
}

// Ring that counts up from zero after a delay, for the flip-card reveal.
export function AnimatedRing({
  size,
  r,
  stroke,
  color,
  score,
  delayMs,
}: {
  size: number;
  r: number;
  stroke: number;
  color: string;
  score: number; // 0-1
  delayMs: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? score : 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (reduced) {
      setShown(score);
      return;
    }
    const controls = animate(0, score, {
      duration: 0.9,
      delay: delayMs / 1000,
      ease: [0.33, 1, 0.68, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [score, delayMs, reduced]);

  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative flex-none"
      style={{ width: size, height: size, animation: `dd-settle 0.5s ease ${delayMs + 860}ms both` }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--dd-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, shown)))}
          style={{ transition: "stroke 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums">
        {Math.round(shown * 100)}
        <span style={{ fontSize: "0.6em", fontWeight: 600, opacity: 0.65, marginLeft: 0.5 }}>%</span>
      </div>
    </div>
  );
}

// PASS / MIXED / FLAG chip, optionally stamping in after a delay.
export function VerdictChip({
  verdict,
  stampDelayMs,
  small,
}: {
  verdict: Verdict3;
  stampDelayMs?: number;
  small?: boolean;
}) {
  const m = verdictMeta(verdict);
  return (
    <span
      className={
        small
          ? "flex-none rounded-[7px] px-[9px] py-1 text-[10.5px] font-bold tracking-[0.04em]"
          : "flex-none rounded-lg px-[11px] py-[5px] text-[11px] font-bold tracking-[0.05em]"
      }
      style={{
        background: m.soft,
        color: m.color,
        animation:
          stampDelayMs !== undefined
            ? `dd-stamp 0.45s cubic-bezier(0.34,1.56,0.64,1) ${stampDelayMs}ms both`
            : undefined,
      }}
    >
      {m.label}
    </span>
  );
}
