import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, passesFilters, type TickerMetrics } from "./screener";

const baseRow: TickerMetrics = {
  ticker: "TEST",
  name: "Test Co",
  sector: "Technology",
  industry: "Software",
  price: 100,
  marketCap: 1e10,
  peRatio: 20,
  pbRatio: 3,
  evEbitda: 10,
  profitMargin: 0.15,
  roe: 0.2,
  roa: 0.08,
  revenueGrowth: 0.1,
  earningsGrowth: 0.12,
  dividendYield: 0.01,
  avgVolume: 1e6,
  debtToEquity: 0.8,
};

describe("passesFilters", () => {
  it("pasa cuando todas las métricas cumplen los defaults", () => {
    const { passed, failures } = passesFilters(baseRow, DEFAULT_FILTERS);
    expect(passed).toBe(true);
    expect(failures).toEqual([]);
  });

  it("falla por P/E por encima del máximo", () => {
    const { passed, failures } = passesFilters(
      { ...baseRow, peRatio: 30 },
      DEFAULT_FILTERS
    );
    expect(passed).toBe(false);
    expect(failures[0]).toContain("P/E Ratio");
  });

  it("falla por ROE por debajo del mínimo", () => {
    const { passed, failures } = passesFilters(
      { ...baseRow, roe: 0.05 },
      DEFAULT_FILTERS
    );
    expect(passed).toBe(false);
    expect(failures.some((f) => f.includes("ROE"))).toBe(true);
  });

  it("un valor null cuenta como fallo con mensaje 'no data'", () => {
    const { passed, failures } = passesFilters(
      { ...baseRow, pbRatio: null },
      DEFAULT_FILTERS
    );
    expect(passed).toBe(false);
    expect(failures).toContain("P/B Ratio: no data");
  });

  it("acumula todos los fallos, no solo el primero", () => {
    const { failures } = passesFilters(
      { ...baseRow, peRatio: 999, roe: 0, debtToEquity: 99 },
      DEFAULT_FILTERS
    );
    expect(failures.length).toBeGreaterThanOrEqual(3);
  });
});
