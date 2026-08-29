"use client";

import { useMemo, useState } from "react";
import type { HistoricalYear } from "@/lib/finance/historical";
import { intrinsicPrice, projectFcf, terminalValue } from "@/lib/finance/dcf";
import { Card, SectionLabel } from "../ui";

function heatColor(marginPct: number): string {
  // Divergente azul<->rojo de la paleta validada, con gris neutro en 0.
  const clamped = Math.max(-40, Math.min(40, marginPct));
  const t = (clamped + 40) / 80; // 0..1
  if (t < 0.5) {
    return mix("#e66767", "#383835", t / 0.5); // rojo -> gris
  }
  return mix("#383835", "#3987e5", (t - 0.5) / 0.5); // gris -> azul
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
        <p className="text-sm text-[var(--text-secondary)]">
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
    <div className="space-y-6">
      <Card>
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
      </Card>

      <Card>
        <SectionLabel>
          Sensitivity Analysis — Intrinsic Value (10yr){" "}
          {price !== null && `vs Current Price ($${price.toFixed(2)})`}
        </SectionLabel>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Azul = infravalorado, Rojo = sobrevalorado, respecto al precio actual.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="p-2 font-mono text-[var(--text-muted)]">WACC \ g</th>
                {growthSteps.map((g) => (
                  <th key={g} className="p-2 font-mono text-[var(--text-muted)]">
                    {g.toFixed(1)}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waccSteps.map((w, i) => (
                <tr key={w}>
                  <td className="p-2 font-mono text-[var(--text-muted)]">{w.toFixed(2)}%</td>
                  {matrix[i].map((val, j) => {
                    const margin = val !== null && price ? ((val - price) / price) * 100 : 0;
                    return (
                      <td
                        key={j}
                        className="p-2 font-mono font-semibold text-white"
                        style={{ background: val !== null ? heatColor(margin) : "var(--surface-2)" }}
                        title={val !== null ? `WACC ${w.toFixed(2)}% · g ${growthSteps[j].toFixed(1)}%` : ""}
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
      </Card>
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
      <div className="mb-1 text-xs text-[var(--text-secondary)]">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--series-1)]"
      />
    </div>
  );
}
