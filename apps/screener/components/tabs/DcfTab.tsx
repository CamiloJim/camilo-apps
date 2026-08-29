"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { HistoricalYear } from "@/lib/finance/historical";
import { intrinsicPrice, projectFcf, terminalValue } from "@/lib/finance/dcf";
import { Card, SectionLabel, fmtBillions, fmtUsd } from "../ui";
import { MarginGauge } from "../Gauge";

export function DcfTab({
  hist,
  wacc,
  riskFree,
  price,
  shares,
  manualGrowth,
  manualWacc,
}: {
  hist: HistoricalYear[];
  wacc: number;
  riskFree: { rate: number; source: string };
  price: number | null;
  shares: number | null;
  manualGrowth: number | null;
  manualWacc: number | null;
}) {
  const fcfSeries = hist.filter((h) => h.fcf !== null).slice(-3);
  const baseFcf =
    fcfSeries.length >= 2
      ? fcfSeries.reduce((s, h) => s + (h.fcf ?? 0), 0) / fcfSeries.length
      : null;

  const histGrowth = useMemo(() => {
    const yoys = hist.map((h) => h.fcfYoY).filter((v): v is number => v !== null);
    if (yoys.length === 0) return 8;
    const avg = yoys.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, yoys.length);
    return Math.min(Math.max(avg, -30), 40);
  }, [hist]);

  const [growthPct, setGrowthPct] = useState(Math.round(histGrowth * 10) / 10);
  const [waccPct, setWaccPct] = useState(Math.round(wacc * 1000) / 10);
  const [perpGrowthPct, setPerpGrowthPct] = useState(2.5);

  if (baseFcf === null || baseFcf <= 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-secondary)]">
          Insufficient or negative FCF history — DCF not available.
        </p>
      </Card>
    );
  }

  const growthUsed = (manualGrowth ?? growthPct) / 100;
  const waccUsed = (manualWacc ?? waccPct) / 100;
  const perpGrowth = perpGrowthPct / 100;

  const lastRow = hist[hist.length - 1];
  const netCash = (lastRow?.cash ?? 0) - (lastRow?.debt ?? 0);
  const sharesN = shares ?? 1;

  const fcfs5 = projectFcf(baseFcf, growthUsed, 5);
  const fcfs10 = projectFcf(baseFcf, growthUsed, 10);
  const tv5 = terminalValue(fcfs5[fcfs5.length - 1], waccUsed, perpGrowth);
  const tv10 = terminalValue(fcfs10[fcfs10.length - 1], waccUsed, perpGrowth);
  const price5 = intrinsicPrice(fcfs5, tv5, waccUsed, netCash, sharesN);
  const price10 = intrinsicPrice(fcfs10, tv10, waccUsed, netCash, sharesN);
  const margin5 = price ? ((price5 - price) / price) * 100 : 0;
  const margin10 = price ? ((price10 - price) / price) * 100 : 0;

  const pvs = fcfs10.map((f, i) => f / Math.pow(1 + waccUsed, i + 1));
  const projData = fcfs10.map((f, i) => ({
    year: `Y${i + 1}`,
    "Projected FCF": f / 1e9,
    "PV (discounted)": pvs[i] / 1e9,
  }));

  const pvFcfs10 = pvs.reduce((a, b) => a + b, 0);
  const pvTv10 = tv10 / Math.pow(1 + waccUsed, 10);
  const pieData = [
    { name: "PV of FCFs", value: Math.max(pvFcfs10, 0), color: "var(--series-1)" },
    { name: "PV of Terminal Value", value: Math.max(pvTv10, 0), color: "var(--series-3)" },
    { name: "Net Cash", value: Math.max(netCash, 0), color: "var(--series-4)" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel>DCF Parameters</SectionLabel>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <SliderField
            label="FCF Growth Rate (%)"
            value={growthPct}
            min={-20}
            max={40}
            step={0.5}
            disabled={manualGrowth !== null}
            onChange={setGrowthPct}
          />
          <SliderField
            label="WACC (%)"
            value={waccPct}
            min={3}
            max={20}
            step={0.25}
            disabled={manualWacc !== null}
            onChange={setWaccPct}
          />
          <SliderField
            label="Perpetual Growth (%)"
            value={perpGrowthPct}
            min={1}
            max={4}
            step={0.1}
            onChange={setPerpGrowthPct}
          />
        </div>
        <p className="mt-4 font-mono text-xs text-[var(--text-muted)]">
          Risk-Free Rate: {(riskFree.rate * 100).toFixed(2)}% ({riskFree.source})
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Current Price
          </div>
          <div className="mt-1 font-mono text-lg font-bold">{fmtUsd(price)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Intrinsic Value (5yr)
          </div>
          <div className="mt-1 font-mono text-lg font-bold">{fmtUsd(price5)}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {margin5 >= 0 ? "+" : ""}
            {margin5.toFixed(1)}%
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Intrinsic Value (10yr)
          </div>
          <div className="mt-1 font-mono text-lg font-bold">{fmtUsd(price10)}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {margin10 >= 0 ? "+" : ""}
            {margin10.toFixed(1)}%
          </div>
        </Card>
      </div>

      <Card>
        <SectionLabel>Projected FCF — 10 Years</SectionLabel>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={projData}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} />
            <YAxis stroke="var(--text-muted)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Projected FCF" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="PV (discounted)"
              stroke="var(--series-3)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionLabel>Margin of Safety</SectionLabel>
        <div className="flex flex-wrap justify-around gap-6">
          <MarginGauge label="5-Year Horizon" margin={margin5} />
          <MarginGauge label="10-Year Horizon" margin={margin10} />
        </div>
      </Card>

      <Card>
        <SectionLabel>Year-by-Year DCF Table</SectionLabel>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
              <th className="py-1.5 font-medium">Year</th>
              <th className="py-1.5 font-medium">Projected FCF</th>
              <th className="py-1.5 font-medium">PV (discounted)</th>
              <th className="py-1.5 font-medium">Cumulative PV</th>
            </tr>
          </thead>
          <tbody>
            {fcfs10.map((f, i) => (
              <tr key={i} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5 font-mono">Y{i + 1}</td>
                <td className="py-1.5 font-mono">{fmtBillions(f)}</td>
                <td className="py-1.5 font-mono">{fmtBillions(pvs[i])}</td>
                <td className="py-1.5 font-mono">
                  {fmtBillions(pvs.slice(0, i + 1).reduce((a, b) => a + b, 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <SectionLabel>Value Composition (10yr)</SectionLabel>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110}>
              {pieData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v) => fmtBillions(typeof v === "number" ? v : null)}
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--text-primary)]">{value.toFixed(2)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--series-1)] disabled:opacity-40"
      />
    </div>
  );
}
