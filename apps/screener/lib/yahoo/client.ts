import YahooFinance from "yahoo-finance2";

// Yahoo Finance no tiene API pública oficial. El cliente casero con cookie+crumb
// fallaba en Vercel (429 en getcrumb desde IPs de datacenter). yahoo-finance2
// mantiene el flujo de autenticación y lo prueba en entornos serverless.

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Error con la causa concreta, para no confundir "me bloquearon" con "está roto". */
export class YahooError extends Error {
  constructor(
    message: string,
    readonly kind: "rate_limited" | "no_cookie" | "no_crumb" | "upstream",
    readonly detail?: string
  ) {
    super(message);
    this.name = "YahooError";
  }
}

function classifyError(err: unknown): YahooError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("429") || lower.includes("too many requests") || lower.includes("rate limit")) {
    return new YahooError(
      "Yahoo Finance está limitando las peticiones desde este servidor (HTTP 429). Vuelve a intentarlo en unos minutos.",
      "rate_limited",
      message
    );
  }

  return new YahooError(`Yahoo Finance no respondió: ${message}`, "upstream", message);
}

async function withYahooError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw classifyError(err);
  }
}

export interface YahooQuoteSummary {
  price?: {
    regularMarketPrice?: { raw: number };
    longName?: string;
    sector?: string;
    industry?: string;
  };
  summaryDetail?: {
    marketCap?: { raw: number };
    trailingPE?: { raw: number };
    priceToBook?: { raw: number };
    dividendYield?: { raw: number };
    averageVolume?: { raw: number };
  };
  defaultKeyStatistics?: {
    enterpriseToEbitda?: { raw: number };
    sharesOutstanding?: { raw: number };
    beta?: { raw: number };
  };
  financialData?: {
    profitMargins?: { raw: number };
    returnOnEquity?: { raw: number };
    returnOnAssets?: { raw: number };
    revenueGrowth?: { raw: number };
    earningsGrowth?: { raw: number };
    debtToEquity?: { raw: number };
  };
}

function asRaw(value: number | null | undefined): { raw: number } | undefined {
  return value == null ? undefined : { raw: value };
}

type QuoteSummaryInput = {
  price?: {
    regularMarketPrice?: number;
    longName?: string;
    sector?: string;
    industry?: string;
  };
  summaryDetail?: {
    marketCap?: number;
    trailingPE?: number;
    priceToBook?: number;
    dividendYield?: number;
    averageVolume?: number;
  };
  defaultKeyStatistics?: {
    enterpriseToEbitda?: number;
    sharesOutstanding?: number;
    beta?: number;
  };
  financialData?: {
    profitMargins?: number;
    returnOnEquity?: number;
    returnOnAssets?: number;
    revenueGrowth?: number;
    earningsGrowth?: number;
    debtToEquity?: number;
  };
};

function mapQuoteSummary(result: QuoteSummaryInput): YahooQuoteSummary {
  return {
    price: result.price
      ? {
          regularMarketPrice: asRaw(result.price.regularMarketPrice),
          longName: result.price.longName,
          sector: result.price.sector,
          industry: result.price.industry,
        }
      : undefined,
    summaryDetail: result.summaryDetail
      ? {
          marketCap: asRaw(result.summaryDetail.marketCap),
          trailingPE: asRaw(result.summaryDetail.trailingPE),
          priceToBook: asRaw(result.summaryDetail.priceToBook),
          dividendYield: asRaw(result.summaryDetail.dividendYield),
          averageVolume: asRaw(result.summaryDetail.averageVolume),
        }
      : undefined,
    defaultKeyStatistics: result.defaultKeyStatistics
      ? {
          enterpriseToEbitda: asRaw(result.defaultKeyStatistics.enterpriseToEbitda),
          sharesOutstanding: asRaw(result.defaultKeyStatistics.sharesOutstanding),
          beta: asRaw(result.defaultKeyStatistics.beta),
        }
      : undefined,
    financialData: result.financialData
      ? {
          profitMargins: asRaw(result.financialData.profitMargins),
          returnOnEquity: asRaw(result.financialData.returnOnEquity),
          returnOnAssets: asRaw(result.financialData.returnOnAssets),
          revenueGrowth: asRaw(result.financialData.revenueGrowth),
          earningsGrowth: asRaw(result.financialData.earningsGrowth),
          debtToEquity: asRaw(result.financialData.debtToEquity),
        }
      : undefined,
  };
}

export async function fetchQuoteSummary(ticker: string): Promise<YahooQuoteSummary | null> {
  const result = (await withYahooError(() =>
    yahooFinance.quoteSummary(ticker, {
      modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData"],
    })
  )) as QuoteSummaryInput | null;

  return result ? mapQuoteSummary(result) : null;
}

export interface YahooTimeseriesPoint {
  asOfDate: string;
  reportedValue: { raw: number };
}

export type YahooTimeseries = Record<string, YahooTimeseriesPoint[]>;

const FUNDAMENTALS_FIELD_MAP: Array<[type: string, key: string]> = [
  ["annualTotalRevenue", "totalRevenue"],
  ["annualOperatingIncome", "operatingIncome"],
  ["annualNetIncome", "netIncome"],
  ["annualOperatingCashFlow", "operatingCashFlow"],
  ["annualCapitalExpenditure", "capitalExpenditure"],
  ["annualTotalDebt", "totalDebt"],
  ["annualCashAndCashEquivalents", "cashAndCashEquivalents"],
  ["annualStockholdersEquity", "stockholdersEquity"],
  ["annualInterestExpense", "interestExpense"],
  ["annualTaxProvision", "taxProvision"],
  ["annualPretaxIncome", "pretaxIncome"],
];

/** 12 años atrás hasta hoy — de sobra para los últimos 5 ejercicios fiscales. */
export async function fetchFundamentalsTimeseries(ticker: string): Promise<YahooTimeseries> {
  const period1 = new Date(Date.now() - 12 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows = await withYahooError(() =>
    yahooFinance.fundamentalsTimeSeries(ticker, {
      period1,
      type: "annual",
      module: "all",
    })
  );

  const out: YahooTimeseries = {};

  for (const row of rows) {
    const asOfDate =
      row.date instanceof Date ? row.date.toISOString() : new Date(String(row.date)).toISOString();
    const record = row as Record<string, unknown>;

    for (const [type, key] of FUNDAMENTALS_FIELD_MAP) {
      const value = record[key];
      if (typeof value !== "number" || Number.isNaN(value)) continue;
      if (!out[type]) out[type] = [];
      out[type].push({ asOfDate, reportedValue: { raw: value } });
    }
  }

  return out;
}

/** ^TNX = 10-Year Treasury Yield, cotiza en porcentaje (ej. 4.33 → 0.0433). */
export async function fetchRiskFreeRate(): Promise<{ rate: number; source: string }> {
  try {
    const summary = await fetchQuoteSummary("%5ETNX");
    const raw = summary?.price?.regularMarketPrice?.raw;
    if (raw && raw > 0) {
      return { rate: raw / 100, source: "Yahoo Finance ^TNX" };
    }
  } catch {
    // cae al fallback
  }
  return { rate: 0.0375, source: "fallback (3.75%)" };
}

/** Diagnóstico: comprueba conectividad real con Yahoo desde la IP del servidor. */
export async function diagnose(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { client: "yahoo-finance2" };

  try {
    const quote = await yahooFinance.quoteSummary("AAPL", { modules: ["price"] });
    out.quoteSummary = quote.price?.regularMarketPrice != null ? "ok" : "empty";
    out.price = quote.price?.regularMarketPrice ?? null;
  } catch (e) {
    out.quoteSummary = `error: ${(e as Error).message}`;
  }

  try {
    const ts = await yahooFinance.fundamentalsTimeSeries("AAPL", {
      period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      type: "annual",
      module: "financials",
    });
    out.fundamentalsTimeSeries = ts.length > 0 ? `ok (${ts.length} rows)` : "empty";
  } catch (e) {
    out.fundamentalsTimeSeries = `error: ${(e as Error).message}`;
  }

  return out;
}
