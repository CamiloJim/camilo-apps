// Piezas de UI propias del Screener.
//
// Card, SectionLabel, Kpi y fmtUsd se movieron a @camilo-apps/ui cuando el
// Trading Tracker apareció como segundo consumidor real. Se reexportan desde
// aquí para no tocar los imports de las tabs.
//
// Lo de abajo es específico de este análisis (PASS/FAIL de filtros, veredicto
// de valoración, magnitudes en miles de millones) y el Tracker no lo usa, así
// que no sube al paquete compartido.
"use client";

export { Card, SectionLabel, Kpi, fmtUsd } from "@camilo-apps/ui";

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
