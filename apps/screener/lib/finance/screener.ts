// Portado 1:1 desde screener.py (repo original CamiloJimenez-stockscreener).

export interface TickerMetrics {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  price: number | null;
  marketCap: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  evEbitda: number | null;
  profitMargin: number | null;
  roe: number | null;
  roa: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  dividendYield: number | null;
  avgVolume: number | null;
  debtToEquity: number | null;
}

export interface ScreenerFilters {
  maxPeRatio: number;
  maxPbRatio: number;
  maxEvEbitda: number;
  minProfitMargin: number;
  minRoe: number;
  minRoa: number;
  minRevenueGrowth: number;
  minEarningsGrowth: number;
  maxDebtToEquity: number;
}

/** Defaults exactos del sidebar original de app.py. */
export const DEFAULT_FILTERS: ScreenerFilters = {
  maxPeRatio: 25,
  maxPbRatio: 4,
  maxEvEbitda: 12,
  minProfitMargin: 0.1,
  minRoe: 0.13,
  minRoa: 0.05,
  minRevenueGrowth: 0.07,
  minEarningsGrowth: 0.08,
  maxDebtToEquity: 1.5,
};

export function passesFilters(
  row: TickerMetrics,
  filters: ScreenerFilters
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  const check = (
    value: number | null,
    minVal: number | null,
    maxVal: number | null,
    label: string
  ) => {
    if (value === null) {
      failures.push(`${label}: no data`);
      return;
    }
    if (minVal !== null && value < minVal) {
      failures.push(`${label} ${value.toFixed(3)} < min ${minVal}`);
    }
    if (maxVal !== null && value > maxVal) {
      failures.push(`${label} ${value.toFixed(3)} > max ${maxVal}`);
    }
  };

  check(row.peRatio, null, filters.maxPeRatio, "P/E Ratio");
  check(row.pbRatio, null, filters.maxPbRatio, "P/B Ratio");
  check(row.evEbitda, null, filters.maxEvEbitda, "EV/EBITDA");
  check(row.profitMargin, filters.minProfitMargin, null, "Profit Margin");
  check(row.roe, filters.minRoe, null, "ROE");
  check(row.roa, filters.minRoa, null, "ROA");
  check(row.revenueGrowth, filters.minRevenueGrowth, null, "Revenue Growth");
  check(row.earningsGrowth, filters.minEarningsGrowth, null, "Earnings Growth");
  check(row.debtToEquity, null, filters.maxDebtToEquity, "Debt/Equity");

  return { passed: failures.length === 0, failures };
}
