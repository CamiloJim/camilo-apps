import { NextResponse } from "next/server";
import {
  fetchFundamentalsTimeseries,
  fetchQuoteSummary,
  fetchRiskFreeRate,
} from "@/lib/yahoo/client";
import { buildHistoricalTable } from "@/lib/finance/historical";
import { calcWacc } from "@/lib/finance/dcf";
import { cached, TTL } from "@/lib/cache/market-cache";
import type { TickerMetrics } from "@/lib/finance/screener";
import type { AnnualPoint } from "@/lib/finance/dcf";

export const dynamic = "force-dynamic";

function toSeries(ts: Record<string, Array<{ asOfDate: string; reportedValue: { raw: number } }>>, type: string): AnnualPoint[] {
  return (ts[type] ?? []).map((p) => ({
    year: new Date(p.asOfDate).getFullYear(),
    value: p.reportedValue.raw,
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const ticker = symbol.trim().toUpperCase();

  try {
    // Cada dato con su propio TTL: los fundamentales cambian por trimestre, el
    // precio en mercado abierto, y la tasa libre de riesgo es una sola para
    // toda la app (por eso su clave no lleva ticker).
    const [quoteSummary, timeseries, riskFree] = await Promise.all([
      cached(`quote:${ticker}`, TTL.quote, () => fetchQuoteSummary(ticker)),
      cached(`fundamentals:${ticker}`, TTL.fundamentals, () =>
        fetchFundamentalsTimeseries(ticker)
      ),
      cached("riskfree:TNX", TTL.riskFree, () => fetchRiskFreeRate()),
    ]);

    if (!quoteSummary || quoteSummary.price?.regularMarketPrice?.raw == null) {
      return NextResponse.json(
        { error: `No data found for ${ticker}. Check the ticker symbol.` },
        { status: 404 }
      );
    }

    const row: TickerMetrics = {
      ticker,
      name: quoteSummary.price?.longName ?? ticker,
      sector: quoteSummary.price?.sector ?? "—",
      industry: quoteSummary.price?.industry ?? "—",
      price: quoteSummary.price?.regularMarketPrice?.raw ?? null,
      marketCap: quoteSummary.summaryDetail?.marketCap?.raw ?? null,
      peRatio: quoteSummary.summaryDetail?.trailingPE?.raw ?? null,
      pbRatio: quoteSummary.summaryDetail?.priceToBook?.raw ?? null,
      evEbitda: quoteSummary.defaultKeyStatistics?.enterpriseToEbitda?.raw ?? null,
      profitMargin: quoteSummary.financialData?.profitMargins?.raw ?? null,
      roe: quoteSummary.financialData?.returnOnEquity?.raw ?? null,
      roa: quoteSummary.financialData?.returnOnAssets?.raw ?? null,
      revenueGrowth: quoteSummary.financialData?.revenueGrowth?.raw ?? null,
      earningsGrowth: quoteSummary.financialData?.earningsGrowth?.raw ?? null,
      dividendYield: quoteSummary.summaryDetail?.dividendYield?.raw ?? null,
      avgVolume: quoteSummary.summaryDetail?.averageVolume?.raw ?? null,
      debtToEquity:
        quoteSummary.financialData?.debtToEquity?.raw != null
          ? quoteSummary.financialData.debtToEquity.raw / 100
          : null,
    };

    const hist = buildHistoricalTable(timeseries);

    const wacc = calcWacc({
      // `beta` sí viene en defaultKeyStatistics; si falta, calcWacc usa 1.0 por
      // defecto, igual que el dcf.py original cuando info.get("beta") era None.
      beta: quoteSummary.defaultKeyStatistics?.beta?.raw ?? null,
      riskFreeRate: riskFree.rate,
      interestExpense: toSeries(timeseries, "annualInterestExpense"),
      totalDebt: toSeries(timeseries, "annualTotalDebt"),
      taxProvision: toSeries(timeseries, "annualTaxProvision"),
      pretaxIncome: toSeries(timeseries, "annualPretaxIncome"),
      marketCap: row.marketCap,
    });

    return NextResponse.json({
      row,
      hist,
      wacc,
      riskFree,
      shares: quoteSummary.defaultKeyStatistics?.sharesOutstanding?.raw ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Error fetching ${ticker}: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
