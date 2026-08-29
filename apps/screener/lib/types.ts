import type { TickerMetrics } from "./finance/screener";
import type { HistoricalYear } from "./finance/historical";

export interface TickerApiResponse {
  row: TickerMetrics;
  hist: HistoricalYear[];
  wacc: number;
  riskFree: { rate: number; source: string };
  shares: number | null;
}

export interface TickerApiError {
  error: string;
}
