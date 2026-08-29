import { describe, expect, it } from "vitest";
import { calcWacc, intrinsicPrice, projectFcf, terminalValue } from "./dcf";

describe("projectFcf", () => {
  it("proyecta con crecimiento compuesto, año 1 ya crecido", () => {
    const result = projectFcf(100, 0.1, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(110); // 100 * 1.1^1
    expect(result[1]).toBeCloseTo(121); // 100 * 1.1^2
    expect(result[2]).toBeCloseTo(133.1); // 100 * 1.1^3
  });

  it("crecimiento cero devuelve el mismo FCF cada año", () => {
    expect(projectFcf(50, 0, 4)).toEqual([50, 50, 50, 50]);
  });
});

describe("terminalValue", () => {
  it("calcula el valor terminal con la fórmula de Gordon", () => {
    // TV = FCF_last * (1+g) / (WACC-g)
    expect(terminalValue(100, 0.1, 0.02)).toBeCloseTo((100 * 1.02) / 0.08);
  });

  it("devuelve 0 si WACC <= growth perpetuo (evita división inválida)", () => {
    expect(terminalValue(100, 0.02, 0.02)).toBe(0);
    expect(terminalValue(100, 0.01, 0.02)).toBe(0);
  });
});

describe("intrinsicPrice", () => {
  it("devuelve 0 si no hay acciones en circulación", () => {
    expect(intrinsicPrice([10, 20], 100, 0.1, 5, 0)).toBe(0);
  });

  it("descuenta FCFs + valor terminal + caja neta, dividido en acciones", () => {
    const fcfs = [100, 100];
    const wacc = 0.1;
    const tv = 1000;
    const netCash = 50;
    const shares = 10;

    const pvFcfs = 100 / 1.1 + 100 / 1.1 ** 2;
    const pvTv = 1000 / 1.1 ** 2;
    const expected = (pvFcfs + pvTv + netCash) / shares;

    expect(intrinsicPrice(fcfs, tv, wacc, netCash, shares)).toBeCloseTo(expected);
  });
});

describe("calcWacc", () => {
  it("usa beta=1.0 y costos por defecto cuando no hay datos de deuda/impuestos", () => {
    const wacc = calcWacc({
      beta: null,
      riskFreeRate: 0.04,
      interestExpense: null,
      totalDebt: null,
      taxProvision: null,
      pretaxIncome: null,
      marketCap: 1000,
    });
    // Sin deuda: 100% equity. costEquity = 0.04 + 1.0*0.055 = 0.095
    expect(wacc).toBeCloseTo(0.095);
  });

  it("pondera equity y deuda cuando hay deuda", () => {
    const wacc = calcWacc({
      beta: 1.2,
      riskFreeRate: 0.04,
      interestExpense: [{ year: 2023, value: -40 }],
      totalDebt: [{ year: 2023, value: 1000 }],
      taxProvision: [{ year: 2023, value: 210 }],
      pretaxIncome: [{ year: 2023, value: 1000 }],
      marketCap: 4000,
    });
    // costEquity = 0.04 + 1.2*0.055 = 0.106
    // costDebt = 40/1000 = 0.04, taxRate = 210/1000 = 0.21
    // totalValue = 5000, wE=0.8, wD=0.2
    const expected = 0.8 * 0.106 + 0.2 * 0.04 * (1 - 0.21);
    expect(wacc).toBeCloseTo(expected);
  });

  it("acota el costo de deuda a 15% máximo aunque el ratio sea más alto", () => {
    const wacc = calcWacc({
      beta: 1.0,
      riskFreeRate: 0.04,
      interestExpense: [{ year: 2023, value: -500 }],
      totalDebt: [{ year: 2023, value: 1000 }],
      taxProvision: null,
      pretaxIncome: null,
      marketCap: 0,
    });
    // costDebt real sería 0.5, pero se acota a 0.15. Con marketCap=0, wE=0.
    expect(wacc).toBeCloseTo(1 * 0.15 * (1 - 0.21));
  });
});
