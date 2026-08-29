"use client";

import type { TickerMetrics } from "@/lib/finance/screener";
import { Card, SectionLabel, fmtBillions, fmtPct, fmtX, fmtUsd } from "../ui";

export function ScreenerTab({
  row,
  passed,
  failures,
}: {
  row: TickerMetrics;
  passed: boolean;
  failures: string[];
}) {
  const metrics: Array<[string, string]> = [
    ["Price", fmtUsd(row.price)],
    ["Market Cap", fmtBillions(row.marketCap)],
    ["P/E Ratio", row.peRatio !== null ? row.peRatio.toFixed(2) : "—"],
    ["P/B Ratio", row.pbRatio !== null ? row.pbRatio.toFixed(2) : "—"],
    ["EV/EBITDA", row.evEbitda !== null ? row.evEbitda.toFixed(2) : "—"],
    ["Profit Margin", fmtPct(row.profitMargin)],
    ["ROE", fmtPct(row.roe)],
    ["ROA", fmtPct(row.roa)],
    ["Revenue Growth", fmtPct(row.revenueGrowth)],
    ["Earnings Growth", fmtPct(row.earningsGrowth)],
    ["Dividend Yield", fmtPct(row.dividendYield)],
    ["Debt/Equity", fmtX(row.debtToEquity)],
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <SectionLabel>Screener Result</SectionLabel>
        <div
          className={`font-mono text-base font-bold ${
            passed ? "text-[var(--status-good)]" : "text-[var(--status-critical)]"
          }`}
        >
          {passed ? "✓ Passed all filters" : `✗ Failed ${failures.length} filter(s)`}
        </div>
        {!passed && failures.length > 0 && (
          <ul className="mt-3 space-y-1">
            {failures.map((f) => (
              <li key={f} className="font-mono text-xs text-[var(--status-critical)]">
                ✗ {f}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionLabel>All Metrics</SectionLabel>
        <table className="w-full text-sm">
          <tbody>
            {metrics.map(([label, value]) => (
              <tr key={label} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5 text-[var(--text-secondary)]">{label}</td>
                <td className="py-1.5 text-right font-mono text-[var(--text-primary)]">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
