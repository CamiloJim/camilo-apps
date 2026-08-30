import { describe, expect, it } from "vitest";
import {
  USD_POR_PUNTO,
  calcDia,
  claveFecha,
  getInsight,
  getSemanas,
  getStatsMes,
  type DiaInput,
} from "./calc";

describe("getInsight", () => {
  it("sin operaciones gana sobre todo lo demás", () => {
    expect(getInsight(0, 0, 0)).toBe("Sin operaciones");
    // Aunque los otros valores parezcan buenos, ops=0 manda.
    expect(getInsight(100, 5, 0)).toBe("Sin operaciones");
  });

  it("tasa 100 es día perfecto aunque el R/B sea bajo", () => {
    expect(getInsight(100, 0.1, 3)).toBe("Día perfecto 🎯");
  });

  it("respeta el orden de evaluación en los rangos que se solapan", () => {
    // tasa 90 y rr 2 cumple también "buen desempeño" y "aceptable";
    // gana "eficiente" porque se evalúa antes.
    expect(getInsight(90, 2, 10)).toBe("Operativa eficiente ✅");
    // tasa 90 con rr 1.6: ya no llega a eficiente (rr < 2), cae a buen desempeño.
    expect(getInsight(90, 1.6, 10)).toBe("Buen desempeño 👍");
  });

  it("clasifica los tramos intermedios", () => {
    expect(getInsight(60, 1.5, 5)).toBe("Buen desempeño 👍");
    expect(getInsight(45, 1.2, 5)).toBe("Resultado aceptable ⚖️");
  });

  it("marca revisar errores por tasa baja o por R/B bajo", () => {
    expect(getInsight(30, 3, 10)).toBe("Revisar errores ⚠️");
    expect(getInsight(60, 0.4, 10)).toBe("Revisar errores ⚠️");
  });

  it("cae a en desarrollo cuando no encaja en ningún tramo anterior", () => {
    // tasa 45 con rr 0.8: no llega a "aceptable" (rr<1), no es "revisar
    // errores" (tasa>=40 y rr>=0.5).
    expect(getInsight(45, 0.8, 5)).toBe("En desarrollo 📈");
  });
});

describe("calcDia", () => {
  it("calcula un día mixto con ganadoras y perdedoras", () => {
    // Día real de Camilo: 2026-04-06
    const d = calcDia({ ops: 3, ganadoras: 1, perdedoras: 2, ptsPos: 8, ptsNeg: 14 });
    expect(d.balance).toBe(-6);
    expect(d.tasa).toBeCloseTo(33.333, 3);
    expect(d.avgWin).toBe(8);
    expect(d.avgLoss).toBe(7);
    expect(d.rr).toBeCloseTo(8 / 7, 6);
    expect(d.insight).toBe("Revisar errores ⚠️");
  });

  it("sin perdedoras usa avgWin como R/B, no divide por cero", () => {
    // Día real: 2026-04-13, una sola operación ganadora de 20 puntos.
    const d = calcDia({ ops: 1, ganadoras: 1, perdedoras: 0, ptsPos: 20, ptsNeg: 0 });
    expect(d.avgLoss).toBe(0);
    expect(d.rr).toBe(20);
    expect(d.tasa).toBe(100);
    expect(d.insight).toBe("Día perfecto 🎯");
  });

  it("sin ganadoras ni perdedoras deja el R/B en cero", () => {
    const d = calcDia({ ops: 0, ganadoras: 0, perdedoras: 0, ptsPos: 0, ptsNeg: 0 });
    expect(d.rr).toBe(0);
    expect(d.tasa).toBe(0);
    expect(d.insight).toBe("Sin operaciones");
  });

  it("un día solo perdedor da tasa 0 y R/B 0", () => {
    // Día real: 2026-04-15
    const d = calcDia({ ops: 1, ganadoras: 0, perdedoras: 1, ptsPos: 0, ptsNeg: 7 });
    expect(d.balance).toBe(-7);
    expect(d.tasa).toBe(0);
    expect(d.rr).toBe(0);
  });
});

describe("getStatsMes", () => {
  // Los 7 días reales de abril de 2026, tal como se migraron a Supabase.
  const abril: DiaInput[] = [
    { ops: 3, ganadoras: 1, perdedoras: 2, ptsPos: 8, ptsNeg: 14 },
    { ops: 2, ganadoras: 1, perdedoras: 1, ptsPos: 7.5, ptsNeg: 3.5 },
    { ops: 1, ganadoras: 1, perdedoras: 0, ptsPos: 20, ptsNeg: 0 },
    { ops: 1, ganadoras: 0, perdedoras: 1, ptsPos: 0, ptsNeg: 7 },
    { ops: 1, ganadoras: 0, perdedoras: 1, ptsPos: 0, ptsNeg: 1.75 },
    { ops: 2, ganadoras: 1, perdedoras: 1, ptsPos: 16, ptsNeg: 7 },
    { ops: 3, ganadoras: 2, perdedoras: 1, ptsPos: 12.5, ptsNeg: 7 },
  ];
  const cfgAbril = { balanceInicial: 5000, contratos: 1, comision: 5 };

  it("reproduce los totales conciliados de abril de 2026", () => {
    const s = getStatsMes(abril, cfgAbril)!;
    expect(s.totalOps).toBe(13);
    expect(s.totalGan).toBe(6);
    expect(s.totalPer).toBe(7);
    expect(s.totalPtsPos).toBe(64);
    expect(s.totalPtsNeg).toBe(40.25);
    expect(s.totalBal).toBe(23.75);
    expect(s.diasActivos).toBe(7);
  });

  it("calcula el resultado en dólares descontando comisiones", () => {
    const s = getStatsMes(abril, cfgAbril)!;
    // 23,75 pts × 1 contrato × 50 USD/pt = 1187,50 ; menos 13 ops × 5 = 65
    expect(s.comisiones).toBe(65);
    expect(s.resultadoUsd).toBeCloseTo(1122.5, 6);
    expect(s.retornoPct).toBeCloseTo((1122.5 / 5000) * 100, 6);
  });

  it("escala el resultado con el número de contratos", () => {
    const s = getStatsMes(abril, { ...cfgAbril, contratos: 2 })!;
    // Los puntos se duplican, las comisiones no dependen de los contratos.
    expect(s.resultadoUsd).toBeCloseTo(23.75 * 2 * USD_POR_PUNTO - 65, 6);
  });

  it("la tasa del mes se calcula sobre los totales, no promediando días", () => {
    const s = getStatsMes(abril, cfgAbril)!;
    // 6 ganadoras de 13 operaciones = 46,15 %. El promedio de las tasas
    // diarias daría otra cosa, y sería incorrecto.
    expect(s.tasa).toBeCloseTo((6 / 13) * 100, 6);
    const promedioDiario = abril.reduce((a, d) => a + calcDia(d).tasa, 0) / abril.length;
    expect(s.tasa).not.toBeCloseTo(promedioDiario, 2);
  });

  it("devuelve null si el mes no tiene días registrados", () => {
    expect(getStatsMes([], cfgAbril)).toBeNull();
  });

  it("no divide por cero si el balance inicial es cero", () => {
    const s = getStatsMes(abril, { ...cfgAbril, balanceInicial: 0 })!;
    expect(s.retornoPct).toBe(0);
  });
});

describe("getSemanas", () => {
  it("agrupa abril de 2026 de lunes a viernes", () => {
    const semanas = getSemanas(2026, 4);
    // Abril de 2026 empieza en miércoles: los tres primeros días hábiles
    // forman una semana parcial.
    expect(semanas[0].map(claveFecha)).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
    expect(semanas[1].map(claveFecha)).toEqual([
      "2026-04-06",
      "2026-04-07",
      "2026-04-08",
      "2026-04-09",
      "2026-04-10",
    ]);
  });

  it("nunca incluye sábados ni domingos", () => {
    for (const mes of [1, 2, 4, 7, 12]) {
      for (const semana of getSemanas(2026, mes)) {
        for (const d of semana) {
          expect(d.getUTCDay()).toBeGreaterThanOrEqual(1);
          expect(d.getUTCDay()).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("cubre TODOS los días hábiles del mes", () => {
    // Diferencia deliberada con el original: get_all_weeks descartaba los días
    // hábiles anteriores al primer lunes (1-3 de abril, 1 de mayo de 2026), así
    // que no se podían registrar operaciones esos días. Aquí sí aparecen.
    const semanas = getSemanas(2026, 5);
    const todos = semanas.flat().map(claveFecha);
    expect(todos).toContain("2026-05-01");
    expect(todos.length).toBe(21); // días hábiles de mayo de 2026
  });

  it("febrero de 2026 empieza en lunes y no genera semana vacía", () => {
    const semanas = getSemanas(2026, 2);
    expect(semanas[0].map(claveFecha)[0]).toBe("2026-02-02");
    expect(semanas.every((s) => s.length > 0)).toBe(true);
  });
});
