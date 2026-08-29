// Piezas compartidas de UI para las 4 tabs. Mantenidas en un solo archivo por
// ahora (fase 1, solo Screener) — cuando arranque el Trading Tracker esto se
// mueve a packages/ui para que ambas apps lo compartan.
"use client";

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</div>}
    </Card>
  );
}

export function Badge({ status }: { status: "pass" | "fail" }) {
  const styles =
    status === "pass"
      ? "bg-[var(--status-good)]/12 text-[var(--status-good)] border-[var(--status-good)]/30"
      : "bg-[var(--status-critical)]/12 text-[var(--status-critical)] border-[var(--status-critical)]/30";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold tracking-wide ${styles}`}
    >
      {status === "pass" ? "PASS" : "FAIL"}
    </span>
  );
}

export function Verdict({ margin }: { margin: number }) {
  const label = margin > 20 ? "UNDERVALUED" : margin < -20 ? "OVERVALUED" : "FAIR VALUE";
  const color =
    margin > 20
      ? "text-[var(--status-good)]"
      : margin < -20
        ? "text-[var(--status-critical)]"
        : "text-[var(--status-warning)]";
  return <span className={`font-mono text-sm font-bold ${color}`}>{label}</span>;
}

export function marginColor(margin: number): string {
  if (margin > 20) return "var(--status-good)";
  if (margin < -20) return "var(--status-critical)";
  return "var(--status-warning)";
}

export function fmtBillions(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function fmtPct(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function fmtX(v: number | null, decimals = 2): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v.toFixed(decimals)}x`;
}

export function fmtUsd(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
