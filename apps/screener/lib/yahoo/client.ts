// Yahoo Finance no tiene API pública oficial. yfinance (Python) resuelve esto
// obteniendo una cookie de sesión y un "crumb" (token anti-CSRF) antes de cada
// consulta a quoteSummary/timeseries.
//
// yfinance implementa DOS estrategias y alterna entre ellas cuando una falla:
//   1. "basic" — GET fc.yahoo.com para la cookie, luego getcrumb.
//   2. "csrf"  — flujo de consentimiento por guce.yahoo.com, luego getcrumb.
// La versión anterior de este archivo solo implementaba la 1, y cuando
// fc.yahoo.com empezó a devolver 404 (verificado el 2026-08-30) se quedaba sin
// salida. Ahora se intentan ambas, igual que yfinance.

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

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

interface CrumbSession {
  cookie: string;
  crumb: string;
  fetchedAt: number;
}

// Cache en memoria del módulo — sobrevive entre invocaciones "warm" de la
// función serverless, se pierde en cold start (aceptable: se vuelve a pedir).
let session: CrumbSession | null = null;
const SESSION_TTL_MS = 55 * 60 * 1000;

function cookieHeaderFrom(res: Response): string {
  // getSetCookie() devuelve todas las cookies; el header combinado se rompe con
  // las fechas de Expires, que llevan comas.
  const all = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (all.length > 0) {
    return all.map((c) => c.split(";")[0]).join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0] : "";
}

/** Estrategia 1: cookie desde fc.yahoo.com. */
async function cookieBasic(): Promise<string> {
  const res = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  return cookieHeaderFrom(res);
}

/** Estrategia 2: flujo de consentimiento GDPR de guce.yahoo.com. */
async function cookieCsrf(): Promise<string> {
  const consentRes = await fetch("https://guce.yahoo.com/consent", {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  let cookie = cookieHeaderFrom(consentRes);
  const html = await consentRes.text();

  const csrfToken = /name="csrfToken"\s+value="([^"]+)"/.exec(html)?.[1];
  const sessionId = /name="sessionId"\s+value="([^"]+)"/.exec(html)?.[1];
  if (!csrfToken || !sessionId) {
    // Sin formulario de consentimiento (país sin GDPR): la cookie de guce basta.
    return cookie;
  }

  const body = new URLSearchParams({
    csrfToken,
    sessionId,
    originalDoneUrl: "https://finance.yahoo.com/",
    namespace: "yahoo",
    agree: "agree",
  });

  const collectRes = await fetch(
    `https://consent.yahoo.com/v2/collectConsent?sessionId=${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: consentRes.url,
        Cookie: cookie,
      },
      body,
      redirect: "follow",
    }
  );
  const collectCookie = cookieHeaderFrom(collectRes);
  if (collectCookie) cookie = cookie ? `${cookie}; ${collectCookie}` : collectCookie;

  const copyRes = await fetch(
    `https://guce.yahoo.com/copyConsent?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: { "User-Agent": USER_AGENT, Cookie: cookie }, redirect: "follow" }
  );
  const copyCookie = cookieHeaderFrom(copyRes);
  if (copyCookie) cookie = cookie ? `${cookie}; ${copyCookie}` : copyCookie;

  return cookie;
}

const CRUMB_HOSTS = [
  "https://query1.finance.yahoo.com/v1/test/getcrumb",
  "https://query2.finance.yahoo.com/v1/test/getcrumb",
];

/** Pide el crumb con una cookie dada. Devuelve el crumb, o el motivo del fallo. */
async function tryCrumb(
  cookie: string
): Promise<{ crumb: string } | { failure: "rate_limited" | "unauthorized" | "empty" }> {
  let sawRateLimit = false;

  for (const url of CRUMB_HOSTS) {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Cookie: cookie },
    });

    if (res.status === 429) {
      sawRateLimit = true;
      continue;
    }
    if (res.ok) {
      const text = (await res.text()).trim();
      // Yahoo a veces responde 200 con un cuerpo de error.
      if (text && !text.includes(" ") && text.length < 32) return { crumb: text };
      if (text.toLowerCase().includes("too many requests")) {
        sawRateLimit = true;
        continue;
      }
      return { failure: "empty" };
    }
    if (res.status === 401 || res.status === 403) continue;
  }

  if (sawRateLimit) return { failure: "rate_limited" };
  return { failure: "unauthorized" };
}

async function getSession(): Promise<CrumbSession> {
  if (session && Date.now() - session.fetchedAt < SESSION_TTL_MS) {
    return session;
  }

  const strategies: Array<{ name: string; getCookie: () => Promise<string> }> = [
    { name: "basic", getCookie: cookieBasic },
    { name: "csrf", getCookie: cookieCsrf },
  ];

  let lastFailure: "rate_limited" | "unauthorized" | "empty" | "no_cookie" = "no_cookie";

  for (const strategy of strategies) {
    let cookie = "";
    try {
      cookie = await strategy.getCookie();
    } catch {
      continue;
    }
    if (!cookie) {
      lastFailure = "no_cookie";
      continue;
    }

    const result = await tryCrumb(cookie);
    if ("crumb" in result) {
      session = { cookie, crumb: result.crumb, fetchedAt: Date.now() };
      return session;
    }
    lastFailure = result.failure;
    // Un rate limit es de IP: no lo arregla cambiar de estrategia.
    if (result.failure === "rate_limited") break;
  }

  if (lastFailure === "rate_limited") {
    throw new YahooError(
      "Yahoo Finance está limitando las peticiones desde este servidor (HTTP 429). Vuelve a intentarlo en unos minutos.",
      "rate_limited"
    );
  }
  if (lastFailure === "no_cookie") {
    throw new YahooError(
      "Yahoo Finance no entregó cookie de sesión con ninguna de las dos estrategias.",
      "no_cookie"
    );
  }
  throw new YahooError(
    "Yahoo Finance rechazó la petición de crumb (sin autorización).",
    "no_crumb"
  );
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
    }
  }

  throw new YahooError(
    "Yahoo Finance está limitando las peticiones desde este servidor (HTTP 429). Vuelve a intentarlo en unos minutos.",
    "rate_limited"
  );
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

/** Diagnóstico: qué responde cada pieza del flujo, sin cachear nada. */
export async function diagnose(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  for (const [name, fn] of [
    ["basic", cookieBasic],
    ["csrf", cookieCsrf],
  ] as const) {
    try {
      const cookie = await fn();
      out[`cookie_${name}`] = cookie ? `ok (${cookie.length} chars)` : "vacía";
      if (cookie) {
        const r = await tryCrumb(cookie);
        out[`crumb_${name}`] = "crumb" in r ? "ok" : r.failure;
      }
    } catch (e) {
      out[`cookie_${name}`] = `error: ${(e as Error).message}`;
    }
  }

  return out;
}
