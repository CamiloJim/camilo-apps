// Piezas de UI propias del Trading Tracker.
//
// Card, SectionLabel, Kpi y fmtUsd viven en @camilo-apps/ui porque los comparte
// con el Screener; se reexportan aquí para que los componentes importen de un
// solo sitio. Lo de abajo es específico de esta app (puntos, tasas ya en
// porcentaje, chips de insight) y no sube al paquete.
"use client";

import type { ReactNode } from "react";
import { colorInsight, type Insight } from "@/lib/trading/calc";

export { Card, SectionLabel, Kpi, fmtUsd } from "@camilo-apps/ui";

/** Puntos, con signo explícito. El signo importa más que la magnitud aquí. */
export function fmtPuntos(v: number, decimales = 2): string {
  if (Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimales)}`;
}

/** Porcentaje ya expresado en 0-100 (la tasa del original, no una fracción). */
export function fmtTasa(v: number, decimales = 1): string {
  if (Number.isNaN(v)) return "—";
  return `${v.toFixed(decimales)}%`;
}

export function fmtRatio(v: number): string {
  if (Number.isNaN(v) || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

/** Verde si va a favor, rojo si en contra. Estado, nunca identidad de serie. */
export function colorSigno(v: number): string {
  return v >= 0 ? "var(--status-good)" : "var(--status-critical)";
}

/** Umbrales del original: 50 % objetivo, 40 % mínimo. */
export function colorTasa(tasa: number): string {
  if (tasa >= 50) return "var(--status-good)";
  if (tasa >= 40) return "var(--status-warning)";
  return "var(--status-critical)";
}

/** Umbrales del original: 1,5 objetivo, 1 mínimo. */
export function colorRatio(rr: number): string {
  if (rr >= 1.5) return "var(--status-good)";
  if (rr >= 1) return "var(--status-warning)";
  return "var(--status-critical)";
}

export function ChipInsight({ insight }: { insight: Insight }) {
  const color = colorInsight(insight);
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
      style={{ color, borderColor: `${color}55`, background: `${color}1a` }}
    >
      {insight}
    </span>
  );
}

export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`py-1.5 text-left font-medium ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`py-1.5 font-mono ${className}`}>{children}</td>;
}

/** Input numérico compacto de la rejilla de registro. */
export function InputNum({
  value,
  onChange,
  step = 1,
  min = 0,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={Number.isNaN(value) ? "" : String(value)}
      min={min}
      step={step}
      onChange={(e) => {
        const n = e.target.value === "" ? 0 : Number(e.target.value);
        onChange(Number.isNaN(n) ? 0 : Math.max(min, n));
      }}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-right font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--series-1)]"
    />
  );
}

/** Indicador discreto de guardado. */
export function EstadoGuardado({ estado }: { estado: "idle" | "guardando" | "guardado" }) {
  if (estado === "idle") return null;
  return (
    <span
      className="text-xs"
      style={{ color: estado === "guardado" ? "var(--status-good)" : "var(--text-muted)" }}
      role="status"
      aria-live="polite"
    >
      {estado === "guardando" ? "Guardando…" : "Guardado"}
    </span>
  );
}

/**
 * Envuelve un formatter de tooltip de Recharts.
 *
 * Recharts tipa el valor como `ValueType | undefined` (puede ser string, array
 * o venir vacío), así que un `(v: number) => …` no encaja. Esto normaliza a
 * número una sola vez en lugar de castear en cada gráfico.
 */
export function fmtTooltip(
  fn: (v: number) => string,
  nombre?: string
): (v: unknown, n: unknown) => [string, string] {
  return (v, n) => {
    const num = typeof v === "number" ? v : Number(v);
    return [Number.isFinite(num) ? fn(num) : "—", nombre ?? String(n ?? "")];
  };
}
