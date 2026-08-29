// Yahoo Finance no tiene API pública oficial. yfinance (Python) resuelve esto
// obteniendo una cookie de sesión y un "crumb" (token anti-CSRF) antes de cada
// consulta a quoteSummary/timeseries. Verificado en vivo el 2026-08-29 contra
// query1.finance.yahoo.com — sin cookie+crumb, la API devuelve 401 "Invalid Crumb".

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface CrumbSession {
  cookie: string;
  crumb: string;
  fetchedAt: number;
}

// Cache en memoria del módulo — sobrevive entre invocaciones "warm" de la
// función serverless, se pierde en cold start (aceptable: se vuelve a pedir).
let session: CrumbSession | null = null;
const SESSION_TTL_MS = 55 * 60 * 1000; // el crumb dura horas; refrescamos cada ~55min por margen

async function getSession(): Promise<CrumbSession> {
  if (session && Date.now() - session.fetchedAt < SESSION_TTL_MS) {
    return session;
  }

  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": USER_AGENT },
    redirect: "manual",
  });
  const setCookie = cookieRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0] ?? "";

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();

  session = { cookie, crumb, fetchedAt: Date.now() };
  return session;
}

/** Reintento con backoff en 429 — mismo patrón que screener.py (retries=3). */
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  const { cookie, crumb } = await getSession();
  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${sep}crumb=${encodeURIComponent(crumb)}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(fullUrl, {
      headers: { "User-Agent": USER_AGENT, Cookie: cookie },
    });
    if (res.status !== 429) return res;
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
    } else {
      return res;
    }
  }
  throw new Error("unreachable");
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

export async function fetchQuoteSummary(ticker: string): Promise<YahooQuoteSummary | null> {
  const modules = "price,summaryDetail,defaultKeyStatistics,financialData";
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker
  )}?modules=${modules}`;

  const res = await fetchWithRetry(url);
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.quoteSummary?.result?.[0];
  return result ?? null;
}

export interface YahooTimeseriesPoint {
  asOfDate: string;
  reportedValue: { raw: number };
}

export type YahooTimeseries = Record<string, YahooTimeseriesPoint[]>;

const TIMESERIES_TYPES = [
  "annualTotalRevenue",
  "annualOperatingIncome",
  "annualNetIncome",
  "annualOperatingCashFlow",
  "annualCapitalExpenditure",
  "annualTotalDebt",
  "annualCashAndCashEquivalents",
  "annualStockholdersEquity",
  "annualInterestExpense",
  "annualTaxProvision",
  "annualPretaxIncome",
] as const;

/** 12 años atrás hasta hoy — de sobra para los últimos 5 ejercicios fiscales. */
export async function fetchFundamentalsTimeseries(ticker: string): Promise<YahooTimeseries> {
  const period1 = Math.floor(Date.now() / 1000) - 12 * 365 * 24 * 60 * 60;
  const period2 = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
    ticker
  )}?type=${TIMESERIES_TYPES.join(",")}&period1=${period1}&period2=${period2}`;

  const res = await fetchWithRetry(url);
  if (!res.ok) return {};

  const json = await res.json();
  const results: Array<{ meta?: { type?: string[] }; [key: string]: unknown }> =
    json?.timeseries?.result ?? [];

  const out: YahooTimeseries = {};
  for (const r of results) {
    const type = r.meta?.type?.[0];
    if (!type) continue;
    const points = r[type];
    if (Array.isArray(points)) {
      out[type] = points.filter((p) => p && p.reportedValue) as YahooTimeseriesPoint[];
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
