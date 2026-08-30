// Formateadores compartidos. Igual que en components.tsx: solo lo que usan las
// dos apps. `fmtBillions` y `fmtX` son del Screener; `fmtPoints` es del Tracker.

/** Dólares con dos decimales. `null`/`NaN` -> guion largo, nunca "NaN" en pantalla. */
export function fmtUsd(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
