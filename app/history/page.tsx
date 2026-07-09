"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/Providers";
import { Ring, VerdictChip } from "@/components/dd";
import { verdictOf, verdictMeta } from "@/lib/verdict";
import type { HistoryResponse, HistoryRow, StatusResponse } from "@/lib/types";

type StatusFilter = "all" | "passed" | "flagged";
type DateFilter = "all" | "7d" | "30d";

const STATUS_OPTS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "passed", label: "Passed" },
  { key: "flagged", label: "Flagged" },
];
const DATE_OPTS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

function daysAgo(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}

function dateLabel(ts: number): string {
  const d = daysAgo(ts);
  if (d === 0) return "Just now";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function Segmented<K extends string>({
  options,
  value,
  width,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  width: number;
  onChange(k: K): void;
}) {
  const idx = options.findIndex((o) => o.key === value);
  return (
    <div className="relative flex rounded-full bg-surface2 p-1">
      <div
        className="absolute bottom-1 top-1 rounded-full bg-surface shadow-dd"
        style={{
          left: 4 + idx * width,
          width,
          transition: "left 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className="relative z-[1] py-2 text-center text-[12.5px] transition-colors duration-200"
          style={{
            width,
            fontWeight: value === o.key ? 600 : 500,
            color: value === o.key ? "var(--dd-ink)" : "var(--dd-ink-muted)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const toast = useToast();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [threshold, setThreshold] = useState(0.2);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [sparkDrawn, setSparkDrawn] = useState(false);
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/history").then((r) => r.json() as Promise<HistoryResponse>),
      fetch("/api/status").then((r) => r.json() as Promise<StatusResponse>),
    ])
      .then(([hist, status]) => {
        setRows(hist.rows);
        setThreshold(status.passThreshold);
        setTimeout(() => setSparkDrawn(true), 140);
      })
      .catch(() => {
        toast.push("error", "Could not load history.");
        setRows([]);
      });
    return () => {
      if (exportTimer.current) clearTimeout(exportTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    if (!rows) return [];
    return rows.filter((h) => {
      const v = verdictOf(h.score, threshold);
      if (statusFilter === "passed" && v !== "pass") return false;
      if (statusFilter === "flagged" && v !== "flag") return false;
      const d = daysAgo(h.createdAt);
      if (dateFilter === "7d" && d > 7) return false;
      if (dateFilter === "30d" && d > 30) return false;
      return true;
    });
  }, [rows, threshold, statusFilter, dateFilter]);

  const documentsScanned = useMemo(
    () => new Set((rows ?? []).map((r) => r.scanId)).size,
    [rows]
  );

  const spark = useMemo(() => {
    if (!rows || rows.length < 2) return null;
    const chrono = rows.slice().reverse();
    const n = chrono.length;
    const pts: string[] = [];
    let len = 0;
    let prev: { x: number; y: number } | null = null;
    chrono.forEach((h, i) => {
      const x = 6 + i * (178 / (n - 1));
      const y = 37 - h.score * 31;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      if (prev) len += Math.hypot(x - prev.x, y - prev.y);
      prev = { x, y };
    });
    return { points: pts.join(" "), length: Math.max(1, Math.round(len)) };
  }, [rows]);

  const exportCsv = useCallback(() => {
    if (exportDone) return;
    const a = document.createElement("a");
    a.href = "/api/export?format=csv";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setExportDone(true);
    toast.push("success", "Report exported");
    exportTimer.current = setTimeout(() => setExportDone(false), 2200);
  }, [exportDone, toast]);

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Clear all scan history? This cannot be undone. The quota log is kept.")) return;
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRows([]);
      setExpandedId(null);
      toast.push("success", "History cleared");
    } catch {
      toast.push("error", "Could not clear history.");
    }
  }, [toast]);

  const hasItems = rows !== null && rows.length > 0;

  return (
    <div className="mx-auto max-w-[1120px] px-[30px] pb-16 pt-11" style={{ animation: "dd-fade-up 0.24s ease both" }}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="mb-[5px] text-[26px] font-semibold tracking-[-0.02em]">History</h1>
          <p className="text-[13.5px] text-muted">
            {rows === null
              ? "Loading"
              : rows.length === 0
                ? "No scans yet"
                : `${documentsScanned} documents scanned`}
          </p>
        </div>
        {hasItems && (
          <div className="flex items-center gap-[18px]">
            {spark && (
              <div className="flex flex-col items-end gap-[3px]">
                <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Avg score trend
                </span>
                <svg width="190" height="42" viewBox="0 0 190 42" fill="none">
                  <polyline
                    points={spark.points}
                    fill="none"
                    stroke="var(--dd-teal)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={spark.length}
                    strokeDashoffset={sparkDrawn ? 0 : spark.length}
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
                  />
                </svg>
              </div>
            )}
            <button
              onClick={exportCsv}
              className="relative flex items-center gap-2 rounded-[10px] border border-line bg-surface px-[15px] py-[9px] text-[13px] font-semibold text-ink transition-colors duration-150 hover:border-linestrong"
            >
              <span className="relative inline-flex h-4 w-4 items-center justify-center">
                <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-200" style={{ opacity: exportDone ? 0 : 1 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11M7 10l5 5 5-5M5 20h14" /></svg>
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-teal transition-opacity duration-200" style={{ opacity: exportDone ? 1 : 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path
                      pathLength="1"
                      d="M20 6 9 17l-5-5"
                      strokeDasharray="1"
                      strokeDashoffset={exportDone ? 0 : 1}
                      style={{ transition: "stroke-dashoffset 0.45s ease 0.05s" }}
                    />
                  </svg>
                </span>
              </span>
              <span>{exportDone ? "Exported" : "Export"}</span>
            </button>
            <button
              onClick={() => void clearHistory()}
              className="px-1 py-[6px] text-[12.5px] font-medium text-faint transition-colors duration-150 hover:text-crimson"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {rows === null ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-[18px] rounded-[24px] border border-line bg-surface px-5 py-[70px]">
          <svg width="86" height="86" viewBox="0 0 86 86" style={{ opacity: 0.4 }}>
            <circle cx="43" cy="43" r="34" fill="none" stroke="var(--dd-border-strong)" strokeWidth="6" strokeLinecap="round" strokeDasharray="132 214" transform="rotate(-90 43 43)" />
          </svg>
          <div className="flex w-full max-w-[420px] flex-col gap-[9px]" style={{ opacity: 0.55 }}>
            <div className="h-[13px] w-[72%] rounded-md bg-surface2" />
            <div className="h-[13px] w-full rounded-md bg-surface2" />
            <div className="h-[13px] w-[84%] rounded-md bg-surface2" />
          </div>
          <p className="mt-[6px] text-[14.5px] text-muted">Your first scan will land here.</p>
        </div>
      ) : (
        <>
          <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
            <Segmented<StatusFilter> options={STATUS_OPTS} value={statusFilter} width={96} onChange={(k) => setStatusFilter(k)} />
            <Segmented<DateFilter> options={DATE_OPTS} value={dateFilter} width={88} onChange={(k) => setDateFilter(k)} />
          </div>

          <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
            <div className="grid grid-cols-[2.4fr_1fr_0.9fr_1fr_44px] border-b border-line px-[22px] py-[14px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              <div>Document</div>
              <div>Date</div>
              <div>Score</div>
              <div>Verdict</div>
              <div />
            </div>
            {visible.length === 0 && (
              <p className="px-[22px] py-8 text-sm text-muted">No scans match these filters.</p>
            )}
            {visible.map((row) => {
              const v = verdictOf(row.score, threshold);
              const m = verdictMeta(v);
              const key = row.scanId * 31 + row.provider.length;
              const exp = expandedId === key;
              const hov = hoveredId === key;
              return (
                <div key={`${row.scanId}-${row.provider}`} className="border-b border-line last:border-b-0">
                  <div
                    onClick={() => setExpandedId(exp ? null : key)}
                    onMouseEnter={() => setHoveredId(key)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="relative grid cursor-pointer grid-cols-[2.4fr_1fr_0.9fr_1fr_44px] items-center px-[22px] py-[15px] transition-colors duration-150"
                    style={{ background: exp || hov ? "var(--dd-surface-2)" : "transparent" }}
                  >
                    <div
                      className="absolute bottom-[9px] left-0 top-[9px] w-[2px] rounded-r-sm bg-teal transition-transform duration-200"
                      style={{ transform: `scaleY(${exp || hov ? 1 : 0})`, transformOrigin: "center" }}
                    />
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap pl-2 pr-3 text-sm font-medium">
                      {row.title}
                    </div>
                    <div className="text-[13px] text-muted">{dateLabel(row.createdAt)}</div>
                    <div className="text-[13.5px] font-semibold tabular-nums">
                      {Math.round(row.score * 100)}%
                    </div>
                    <div>
                      <VerdictChip verdict={v} small />
                    </div>
                    <div
                      className="flex justify-end text-faint transition-transform duration-200"
                      style={{ transform: `rotate(${exp ? 180 : 0}deg)` }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                  <div
                    className="grid transition-[grid-template-rows] duration-300"
                    style={{ gridTemplateRows: exp ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-5 px-[22px] pb-[22px] pl-[30px] pt-[6px]">
                        <Ring
                          size={52}
                          r={22}
                          stroke={4.5}
                          color={m.color}
                          progress={exp ? row.score : 0}
                          label={String(Math.round(row.score * 100))}
                          labelSize={12}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-serif text-[15px] italic leading-[1.6] text-ink">
                            {row.topSentence
                              ? `"${row.topSentence}"`
                              : "No sentence breakdown was stored for this scan."}
                          </div>
                          <div className="mt-[6px] text-[11.5px] text-faint">
                            <span className="capitalize">{row.provider}</span> &middot; highest-scoring sentence
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
