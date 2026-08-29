"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { HistoricalYear } from "@/lib/finance/historical";
import { Card, SectionLabel, fmtBillions } from "../ui";

const chartTheme = {
  grid: "var(--border)",
  axis: "var(--text-muted)",
};

export function FinancialsTab({ hist }: { hist: HistoricalYear[] }) {
  if (hist.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-secondary)]">
          No historical financial data available.
        </p>
      </Card>
    );
  }

  const revData = hist.map((h) => ({
    year: h.year,
    Revenue: h.revenue !== null ? h.revenue / 1e9 : null,
    "Net Income": h.netIncome !== null ? h.netIncome / 1e9 : null,
  }));

  const fcfData = hist.map((h) => ({
    year: h.year,
    "Operating CF": h.opCf !== null ? h.opCf / 1e9 : null,
    FCF: h.fcf !== null ? h.fcf / 1e9 : null,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel>Revenue &amp; Net Income (USD Billions)</SectionLabel>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revData}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis dataKey="year" stroke={chartTheme.axis} fontSize={11} />
            <YAxis stroke={chartTheme.axis} fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Revenue" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Net Income" fill="var(--series-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionLabel>Free Cash Flow vs Operating Cash Flow (USD Billions)</SectionLabel>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={fcfData}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis dataKey="year" stroke={chartTheme.axis} fontSize={11} />
            <YAxis stroke={chartTheme.axis} fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Operating CF" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="FCF"
              stroke="var(--series-3)"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionLabel>Year-over-Year Growth (%)</SectionLabel>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
              <th className="py-1.5 font-medium">Year</th>
              <th className="py-1.5 font-medium">Revenue</th>
              <th className="py-1.5 font-medium">Op Income</th>
              <th className="py-1.5 font-medium">Net Income</th>
              <th className="py-1.5 font-medium">FCF</th>
            </tr>
          </thead>
          <tbody>
            {hist.map((h) => (
              <tr key={h.year} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5 font-mono">{h.year}</td>
                <td className="py-1.5 font-mono">{fmtYoY(h.revenueYoY)}</td>
                <td className="py-1.5 font-mono">{fmtYoY(h.opIncomeYoY)}</td>
                <td className="py-1.5 font-mono">{fmtYoY(h.netIncomeYoY)}</td>
                <td className="py-1.5 font-mono">{fmtYoY(h.fcfYoY)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <SectionLabel>Balance Sheet Summary (USD Billions)</SectionLabel>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
              <th className="py-1.5 font-medium">Year</th>
              <th className="py-1.5 font-medium">Debt</th>
              <th className="py-1.5 font-medium">Cash</th>
              <th className="py-1.5 font-medium">Equity</th>
            </tr>
          </thead>
          <tbody>
            {hist.map((h) => (
              <tr key={h.year} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5 font-mono">{h.year}</td>
                <td className="py-1.5 font-mono">{fmtBillions(h.debt)}</td>
                <td className="py-1.5 font-mono">{fmtBillions(h.cash)}</td>
                <td className="py-1.5 font-mono">{fmtBillions(h.equity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function fmtYoY(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
