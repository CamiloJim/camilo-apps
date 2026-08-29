// Portado desde build_historical_table() de dcf.py — arma la tabla de 5 años
// a partir de las series de fundamentals-timeseries de Yahoo.
import type { AnnualPoint } from "./dcf";
import type { YahooTimeseries } from "../yahoo/client";

export interface HistoricalYear {
  year: number;
  revenue: number | null;
  opIncome: number | null;
  netIncome: number | null;
  opCf: number | null;
  capex: number | null;
  debt: number | null;
  cash: number | null;
  equity: number | null;
  fcf: number | null;
  revenueYoY: number | null;
  opIncomeYoY: number | null;
  netIncomeYoY: number | null;
  fcfYoY: number | null;
}

function toAnnualPoints(ts: YahooTimeseries, type: string): AnnualPoint[] {
  const points = ts[type];
  if (!points) return [];
  return points.map((p) => ({
    year: new Date(p.asOfDate).getFullYear(),
    value: p.reportedValue.raw,
  }));
}

function byYear(points: AnnualPoint[]): Map<number, number> {
  return new Map(points.map((p) => [p.year, p.value]));
}

function yoy(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function buildHistoricalTable(ts: YahooTimeseries): HistoricalYear[] {
  const revenue = byYear(toAnnualPoints(ts, "annualTotalRevenue"));
  const opIncome = byYear(toAnnualPoints(ts, "annualOperatingIncome"));
  const netIncome = byYear(toAnnualPoints(ts, "annualNetIncome"));
  const opCf = byYear(toAnnualPoints(ts, "annualOperatingCashFlow"));
  const capex = byYear(toAnnualPoints(ts, "annualCapitalExpenditure"));
  const debt = byYear(toAnnualPoints(ts, "annualTotalDebt"));
  const cash = byYear(toAnnualPoints(ts, "annualCashAndCashEquivalents"));
  const equity = byYear(toAnnualPoints(ts, "annualStockholdersEquity"));

  const years = Array.from(
    new Set([...revenue.keys(), ...netIncome.keys(), ...opCf.keys()])
  )
    .sort((a, b) => a - b)
    .slice(-5);

  const rows: HistoricalYear[] = years.map((year) => {
    const rev = revenue.get(year) ?? null;
    const opInc = opIncome.get(year) ?? null;
    const net = netIncome.get(year) ?? null;
    const ocf = opCf.get(year) ?? null;
    const cpx = capex.get(year) ?? null;
    const fcf = ocf !== null && cpx !== null ? ocf + cpx : null; // capex ya viene negativo

    return {
      year,
      revenue: rev,
      opIncome: opInc,
      netIncome: net,
      opCf: ocf,
      capex: cpx,
      debt: debt.get(year) ?? null,
      cash: cash.get(year) ?? null,
      equity: equity.get(year) ?? null,
      fcf,
      revenueYoY: null,
      opIncomeYoY: null,
      netIncomeYoY: null,
      fcfYoY: null,
    };
  });

  for (let i = 1; i < rows.length; i++) {
    rows[i].revenueYoY = yoy(rows[i].revenue, rows[i - 1].revenue);
    rows[i].opIncomeYoY = yoy(rows[i].opIncome, rows[i - 1].opIncome);
    rows[i].netIncomeYoY = yoy(rows[i].netIncome, rows[i - 1].netIncome);
    rows[i].fcfYoY = yoy(rows[i].fcf, rows[i - 1].fcf);
  }

  return rows;
}
