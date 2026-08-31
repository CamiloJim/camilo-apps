"use client";

import { useMemo, useState } from "react";
import type { HistoricalYear } from "@/lib/finance/historical";
import { intrinsicPrice, projectFcf, terminalValue } from "@/lib/finance/dcf";
import { Card, Widget } from "../ui";

/*
 * Estos tres hex duplican --div-warm, --div-mid y --div-cold de tokens.css.
 * Es la única duplicación deliberada del sistema de diseño: interpolar dos
 * colores exige valores numéricos, y una custom property de CSS no se puede
 * leer desde JS sin getComputedStyle en cada celda. Si cambia la divergente,
 * hay que cambiarla también aquí.
 */
const DIV_WARM = "#e06666";
const DIV_MID = "#3a3a38";
const DIV_COLD = "#6da7ec";

function heatColor(marginPct: number): string {
  // Divergente frío<->cálido con gris neutro en 0, nunca un tono en el centro.
  const clamped = Math.max(-40, Math.min(40, marginPct));
  const t = (clamped + 40) / 80; // 0..1
  if (t < 0.5) {
    return mix(DIV_WARM, DIV_MID, t / 0.5); // sobrevalorado -> neutro
  }
  return mix(DIV_MID, DIV_COLD, (t - 0.5) / 0.5); // neutro -> infravalorado
}

function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function SensitivityTab({
  hist,
  wacc,
  price,
  shares,
}: {
  hist: HistoricalYear[];
  wacc: number;
  price: number | null;
  shares: number | null;
}) {
  const fcfSeries = hist.filter((h) => h.fcf !== null).slice(-3);
  const baseFcf =
    fcfSeries.length >= 2
      ? fcfSeries.reduce((s, h) => s + (h.fcf ?? 0), 0) / fcfSeries.length
      : null;

  const [waccRange, setWaccRange] = useState(3);
  const [growthRange, setGrowthRange] = useState(8);

  const histGrowthCenter = useMemo(() => {
    const yoys = hist.map((h) => h.fcfYoY).filter((v): v is number => v !== null);
    if (yoys.length === 0) return 8;
    const avg = yoys.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, yoys.length);
    return Math.min(Math.max(avg, -20), 35);
  }, [hist]);

  if (baseFcf === null || baseFcf <= 0) {
    return (
      <Card>
        <p className="text-[length:var(--text-md)] text-[var(--text-secondary)]">
          Insufficient FCF data for sensitivity analysis.
        </p>
      </Card>
    );
  }

  const waccCenter = Math.round(wacc * 1000) / 10;
  const growthCenter = Math.round(histGrowthCenter * 10) / 10;

  const waccSteps = linspace(waccCenter - waccRange, waccCenter + waccRange, 7);
  const growthSteps = linspace(growthCenter - growthRange, growthCenter + growthRange, 7);

  const lastRow = hist[hist.length - 1];
  const netCash = (lastRow?.cash ?? 0) - (lastRow?.debt ?? 0);
  const sharesN = shares ?? 1;

  const matrix = waccSteps.map((w) =>
    growthSteps.map((g) => {
      const wR = w / 100;
      const gR = g / 100;
      if (wR <= 0.025) return null;
      const fs = projectFcf(baseFcf, gR, 10);
      const tv = terminalValue(fs[fs.length - 1], wR, 0.025);
      return intrinsicPrice(fs, tv, wR, netCash, sharesN);
    })
  );

  return (
    <div className="space-y-4">
      <Widget title="Rango del análisis" meta="Cuánto se abre la matriz alrededor del centro">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <RangeField
            label={`WACC range (±${waccRange}%)`}
            value={waccRange}
            min={1}
            max={5}
            step={0.5}
            onChange={setWaccRange}
          />
          <RangeField
            label={`Growth range (±${growthRange}%)`}
            value={growthRange}
            min={2}
            max={15}
            step={1}
            onChange={setGrowthRange}
          />
        </div>
      </Widget>

      <Widget
        title="Sensitivity Analysis — Intrinsic Value (10yr)"
        meta={price !== null ? `Contra el precio actual de $${price.toFixed(2)}` : undefined}
        note="Azul es infravalorado y rojo sobrevalorado, siempre respecto al precio actual. Si la matriz cambia de color con un movimiento pequeño de WACC o de crecimiento, la valoración no es robusta."
      >
        {/*
          Esto se queda como tabla y no pasa a la primitiva HeatmapChart: cada
          celda necesita etiqueta de PRECIO y color por MARGEN, que son dos
          magnitudes distintas. Un mapa de calor genérico solo sabe pintar por
          el mismo valor que rotula.
        */}
        <div className="cj-table-wrap">
          <table className="cj-heat-matrix">
            <thead>
              <tr>
                <th>WACC \ g</th>
                {growthSteps.map((g) => (
                  <th key={g}>{g.toFixed(1)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waccSteps.map((w, i) => (
                <tr key={w}>
                  <th scope="row">{w.toFixed(2)}%</th>
                  {matrix[i].map((val, j) => {
                    const margin = val !== null && price ? ((val - price) / price) * 100 : 0;
                    return (
                      <td
                        key={j}
                        style={{
                          background: val !== null ? heatColor(margin) : "var(--surface-2)",
                        }}
                        title={
                          val !== null
                            ? `WACC ${w.toFixed(2)}% · g ${growthSteps[j].toFixed(1)}% → $${val.toFixed(0)} (${margin >= 0 ? "+" : ""}${margin.toFixed(0)}%)`
                            : "WACC demasiado bajo para descontar"
                        }
                      >
                        {val !== null ? `$${val.toFixed(0)}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Widget>
    </div>
  );
}

function linspace(start: number, end: number, n: number): number[] {
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round((start + step * i) * 100) / 100);
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[length:var(--text-md)] text-[var(--text-secondary)]">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--gold)]"
      />
    </div>
  );
}
