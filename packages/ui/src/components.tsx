// Componentes compartidos entre el Screener y el Trading Tracker.
//
// Solo vive aquí lo que usan LAS DOS apps. Lo que use una sola se queda en su
// propia carpeta: un paquete compartido con piezas de un solo consumidor es
// abstracción sin motivo.
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

export function Kpi({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Color del valor. Solo para estado (bueno/malo), nunca para identidad de serie. */
  valueColor?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</div>}
    </Card>
  );
}
