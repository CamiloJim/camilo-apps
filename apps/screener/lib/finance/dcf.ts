// Portado 1:1 desde dcf.py (repo original CamiloJimenez-stockscreener).
// Misma lógica financiera, mismos defaults — solo cambia el lenguaje.

export const MARKET_PREMIUM = 0.055;
export const FALLBACK_RISK_FREE_RATE = 0.0375; // 3.75%, si Yahoo no responde ^TNX

export interface AnnualPoint {
  /** Año fiscal (ej. 2024) */
  year: number;
  value: number;
}

/** WACC = costo ponderado de capital y deuda. */
export function calcWacc(params: {
  beta: number | null;
  riskFreeRate: number;
  /** Serie de "Interest Expense", más reciente primero o en cualquier orden — se usan los últimos 3 por fecha. */
  interestExpense: AnnualPoint[] | null;
  totalDebt: AnnualPoint[] | null;
  taxProvision: AnnualPoint[] | null;
  pretaxIncome: AnnualPoint[] | null;
  marketCap: number | null;
}): number {
  const beta = params.beta ?? 1.0;
  const costEquity = params.riskFreeRate + beta * MARKET_PREMIUM;

  let costDebt = 0.04;
  if (params.interestExpense?.length && params.totalDebt?.length) {
    const avgDebt = average(lastN(params.totalDebt, 3).map((p) => p.value));
    const avgInterest = Math.abs(
      average(lastN(params.interestExpense, 3).map((p) => p.value))
    );
    costDebt = avgDebt ? avgInterest / avgDebt : 0.04;
    costDebt = Math.min(costDebt, 0.15);
  }

  let taxRate = 0.21;
  if (params.taxProvision?.length && params.pretaxIncome?.length) {
    const avgTax = Math.abs(average(lastN(params.taxProvision, 3).map((p) => p.value)));
    const avgPretax = Math.abs(average(lastN(params.pretaxIncome, 3).map((p) => p.value)));
    taxRate = avgPretax ? avgTax / avgPretax : 0.21;
    taxRate = Math.min(Math.max(taxRate, 0.1), 0.4);
  }

  const marketCap = params.marketCap ?? 1;
  const debtLast = params.totalDebt?.length
    ? sortByYear(params.totalDebt).at(-1)!.value
    : 0;
  const totalValue = marketCap + Math.max(debtLast, 0);
  const weightEquity = marketCap / totalValue;
  const weightDebt = Math.max(debtLast, 0) / totalValue;

  return weightEquity * costEquity + weightDebt * costDebt * (1 - taxRate);
}

export function projectFcf(baseFcf: number, growthRate: number, years: number): number[] {
  return Array.from({ length: years }, (_, i) => baseFcf * Math.pow(1 + growthRate, i + 1));
}

export function terminalValue(fcfLast: number, wacc: number, perpetualGrowth: number): number {
  if (wacc <= perpetualGrowth) return 0;
  return (fcfLast * (1 + perpetualGrowth)) / (wacc - perpetualGrowth);
}

export function intrinsicPrice(
  fcfs: number[],
  tv: number,
  wacc: number,
  netCash: number,
  shares: number
): number {
  if (!shares) return 0;
  const pvFcfs = fcfs.reduce((sum, f, i) => sum + f / Math.pow(1 + wacc, i + 1), 0);
  const pvTv = tv / Math.pow(1 + wacc, fcfs.length);
  return (pvFcfs + pvTv + netCash) / shares;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sortByYear(series: AnnualPoint[]): AnnualPoint[] {
  return [...series].sort((a, b) => a.year - b.year);
}

function lastN(series: AnnualPoint[], n: number): AnnualPoint[] {
  return sortByYear(series).slice(-n);
}
