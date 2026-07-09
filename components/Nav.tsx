"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuota } from "./Providers";
import { compact } from "@/lib/verdict";

const LINKS = [
  { href: "/", label: "Scan" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = theme === "dark" ? "light" : "dark";
    const apply = () => {
      flushSync(() => setTheme(next));
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("dd-theme", next);
      } catch {
        // private mode, theme just will not persist
      }
    };

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduced) {
      apply();
      return;
    }

    // Sweep the new theme out from the toggle button.
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    const transition = doc.startViewTransition(apply);
    void transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 1100,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  const light = theme !== "dark";

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative h-9 w-9 flex-none rounded-[10px] border border-line bg-surface text-ink transition-colors duration-200 hover:border-linestrong"
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300"
        style={{
          opacity: light ? 1 : 0,
          transform: `rotate(${light ? 0 : -90}deg) scale(${light ? 1 : 0.4})`,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300"
        style={{
          opacity: light ? 0 : 1,
          transform: `rotate(${light ? 90 : 0}deg) scale(${light ? 0.4 : 1})`,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      </span>
    </button>
  );
}

function QuotaBar() {
  const { quota, pendingChars } = useQuota();

  if (!quota) return <div className="skeleton h-6 w-44" aria-hidden />;

  const usedPct = quota.budget > 0 ? Math.min(100, (quota.used / quota.budget) * 100) : 0;
  const projPct =
    quota.budget > 0
      ? Math.min(100, ((quota.used + pendingChars) / quota.budget) * 100)
      : 0;
  const over = projPct > 80 || usedPct > 80;
  const solid = over ? "var(--dd-amber)" : "var(--dd-teal)";
  const soft = over ? "var(--dd-amber-soft)" : "var(--dd-teal-soft)";

  return (
    <div
      className="flex items-center gap-[9px]"
      title={`${quota.used.toLocaleString()} of ${quota.budget.toLocaleString()} characters used in the last 24 hours`}
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
        Quota
      </span>
      <div className="relative h-[6px] w-[118px] overflow-hidden rounded-full bg-surface2">
        <div
          className="absolute bottom-0 left-0 top-0 rounded-full"
          style={{
            width: `${projPct}%`,
            background: soft,
            transition: "width 0.55s cubic-bezier(0.16,1,0.3,1), background 0.4s ease",
          }}
        />
        <div
          className="absolute bottom-0 left-0 top-0 rounded-full"
          style={{
            width: `${usedPct}%`,
            background: solid,
            transition: "width 0.55s cubic-bezier(0.16,1,0.3,1), background 0.4s ease",
          }}
        />
      </div>
      <span className="min-w-[46px] text-[11.5px] tabular-nums text-muted">
        {compact(quota.used)} / {compact(quota.budget)}
      </span>
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-paper transition-colors duration-300">
      <div className="mx-auto flex max-w-[1280px] items-center gap-7 px-[30px] py-3">
        <div className="flex flex-none flex-col gap-[1px]">
          <span className="text-[15px] font-bold leading-[1.15] tracking-[-0.01em]">
            DetectDeck
          </span>
          <span className="text-[10.5px] font-medium leading-[1.15] text-muted">
            Know before you publish.
          </span>
        </div>
        <nav className="flex items-center gap-[2px]">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="border-b-2 px-3 pb-[11px] pt-[9px] text-[13.5px] transition-colors duration-200"
                style={{
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--dd-ink)" : "var(--dd-ink-muted)",
                  borderBottomColor: active ? "var(--dd-teal)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <QuotaBar />
        <ThemeToggle />
      </div>
    </div>
  );
}
