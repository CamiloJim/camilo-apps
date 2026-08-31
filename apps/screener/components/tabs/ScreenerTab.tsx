"use client";

import type { TickerMetrics } from "@/lib/finance/screener";
import { Tabla, Td, Widget, fmtBillions, fmtPct, fmtX, fmtUsd } from "../ui";

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
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Widget
        title="Screener Result"
        meta={passed ? "Pasa todos los filtros" : `Falla ${failures.length} filtro(s)`}
      >
        <div
          className="font-mono text-[length:var(--text-title-sm)] font-bold"
          style={{ color: passed ? "var(--status-good)" : "var(--status-critical)" }}
        >
          {passed ? "✓ Passed all filters" : `✗ Failed ${failures.length} filter(s)`}
        </div>
        {!passed && failures.length > 0 && (
          <ul className="m-0 list-none space-y-1 p-0">
            {failures.map((f) => (
              <li
                key={f}
                className="font-mono text-[length:var(--text-sm)] text-[var(--status-critical)]"
              >
                ✗ {f}
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="All Metrics">
        <Tabla>
          <tbody>
            {metrics.map(([label, value]) => (
              <tr key={label}>
                <td className="text-[var(--text-secondary)]">{label}</td>
                <Td>{value}</Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Widget>
    </div>
  );
}
