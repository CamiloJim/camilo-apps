// Lógica de cálculo del Trading Tracker, portada 1:1 desde trading_tracker.py
// del repo CamiloJimenez-TradingTracker (Streamlit).
//
// Son las cifras reales de trading de Camilo: cualquier desviación aquí cambia
// sus resultados históricos. Por eso va cubierta con tests unitarios y las
// fórmulas se mantienen idénticas al original aunque alguna se pudiera "mejorar".

/**
 * Valor en dólares de 1 punto de 1 contrato de futuros.
 *
 * Estaba hardcodeado como `* 50` dentro de get_month_stats en el original.
 * 50 USD/punto corresponde a los futuros del S&P 500 E-mini (ES). **Si Camilo
 * opera otro instrumento este número cambia** (p. ej. el Nasdaq E-mini NQ son
 * 20 USD/punto), y con él todos los resultados en dólares.
 */
export const USD_POR_PUNTO = 50;

/** Lo que se captura por día. Es lo único que se persiste. */
export interface DiaInput {
  ops: number;
  ganadoras: number;
  perdedoras: number;
  ptsPos: number;
  ptsNeg: number;
}

/** Lo capturado más todo lo derivado. Nada de esto se guarda en la base. */
export interface DiaCalculado extends DiaInput {
  balance: number;
  tasa: number;
  avgWin: number;
  avgLoss: number;
  rr: number;
  insight: Insight;
}

export type Insight =
  | "Sin operaciones"
  | "Día perfecto 🎯"
  | "Operativa eficiente ✅"
  | "Buen desempeño 👍"
  | "Resultado aceptable ⚖️"
  | "Revisar errores ⚠️"
  | "Día negativo ❌"
  | "En desarrollo 📈";

/**
 * Etiqueta de diagnóstico del día.
 *
 * El ORDEN de las comparaciones importa y se conserva exacto: los rangos se
 * solapan (un día con tasa 90 y rr 1.6 cae en "Operativa eficiente" solo
 * porque esa condición se evalúa antes que "Buen desempeño"). Reordenarlas
 * cambiaría etiquetas de días ya registrados.
 */
export function getInsight(tasa: number, rr: number, ops: number): Insight {
  if (ops === 0) return "Sin operaciones";
  if (tasa === 100) return "Día perfecto 🎯";
  if (tasa >= 80 && rr >= 2) return "Operativa eficiente ✅";
  if (tasa >= 50 && rr >= 1.5) return "Buen desempeño 👍";
  if (tasa >= 40 && rr >= 1) return "Resultado aceptable ⚖️";
  if (tasa < 40 || rr < 0.5) return "Revisar errores ⚠️";
  // Inalcanzable con los datos reales (tasa nunca es negativa), pero se
  // conserva porque estaba en el original.
  if (tasa < 0) return "Día negativo ❌";
  return "En desarrollo 📈";
}

/** Deriva las métricas de un día a partir de lo capturado. */
export function calcDia(row: DiaInput): DiaCalculado {
  const { ops, ganadoras, perdedoras, ptsPos, ptsNeg } = row;
  const balance = ptsPos - ptsNeg;
  const tasa = ops > 0 ? (ganadoras / ops) * 100 : 0;
  const avgWin = ganadoras > 0 ? ptsPos / ganadoras : 0;
  const avgLoss = perdedoras > 0 ? ptsNeg / perdedoras : 0;
  // Sin pérdidas no hay divisor: el original cae a avgWin (un "ratio" contra
  // cero) y a 0 si tampoco hubo ganadoras.
  const rr = avgLoss > 0 ? avgWin / avgLoss : ganadoras > 0 ? avgWin : 0;

  return {
    ops,
    ganadoras,
    perdedoras,
    ptsPos,
    ptsNeg,
    balance,
    tasa,
    avgWin,
    avgLoss,
    rr,
    insight: getInsight(tasa, rr, ops),
  };
}

export interface ConfigMes {
  balanceInicial: number;
  contratos: number;
  comision: number;
}

export interface StatsMes {
  totalOps: number;
  totalGan: number;
  totalPer: number;
  totalPtsPos: number;
  totalPtsNeg: number;
  totalBal: number;
  tasa: number;
  avgWin: number;
  avgLoss: number;
  rr: number;
  resultadoUsd: number;
  comisiones: number;
  balInicial: number;
  contratos: number;
  retornoPct: number;
  diasActivos: number;
  totalDias: number;
}

/**
 * Agrega un mes.
 *
 * Ojo con la tasa y el R/B del mes: NO son el promedio de los diarios, se
 * recalculan sobre los totales. Un día con 1 operación pesa menos que uno con
 * 5, que es lo correcto y lo que hacía el original.
 *
 * Devuelve null si no hay ningún día registrado, igual que el original.
 */
export function getStatsMes(dias: DiaInput[], cfg: ConfigMes): StatsMes | null {
  if (dias.length === 0) return null;

  const rows = dias.map(calcDia);
  const totalOps = rows.reduce((a, r) => a + r.ops, 0);
  const totalGan = rows.reduce((a, r) => a + r.ganadoras, 0);
  const totalPer = rows.reduce((a, r) => a + r.perdedoras, 0);
  const totalPtsPos = rows.reduce((a, r) => a + r.ptsPos, 0);
  const totalPtsNeg = rows.reduce((a, r) => a + r.ptsNeg, 0);
  const totalBal = totalPtsPos - totalPtsNeg;

  const tasa = totalOps > 0 ? (totalGan / totalOps) * 100 : 0;
  const avgWin = totalGan > 0 ? totalPtsPos / totalGan : 0;
  const avgLoss = totalPer > 0 ? totalPtsNeg / totalPer : 0;
  // A nivel mes el original cae a avgWin sin comprobar ganadoras (a diferencia
  // de calc_day). Se conserva tal cual.
  const rr = avgLoss > 0 ? avgWin / avgLoss : avgWin;

  const comisiones = totalOps * cfg.comision;
  const resultadoUsd = totalBal * cfg.contratos * USD_POR_PUNTO - comisiones;
  const retornoPct = cfg.balanceInicial > 0 ? (resultadoUsd / cfg.balanceInicial) * 100 : 0;

  return {
    totalOps,
    totalGan,
    totalPer,
    totalPtsPos,
    totalPtsNeg,
    totalBal,
    tasa,
    avgWin,
    avgLoss,
    rr,
    resultadoUsd,
    comisiones,
    balInicial: cfg.balanceInicial,
    contratos: cfg.contratos,
    retornoPct,
    diasActivos: rows.filter((r) => r.ops > 0).length,
    totalDias: rows.length,
  };
}

/**
 * Agrupa los días hábiles del mes en semanas.
 *
 * Una semana nueva empieza cada lunes; sábados y domingos no existen en esta
 * app. Si el mes no empieza en lunes, los primeros días quedan en la semana 1
 * igual (el original arranca `wk = null` y solo abre semana al ver un lunes,
 * lo que descartaba esos días — aquí se corrige, ver nota abajo).
 */
export function getSemanas(anio: number, mes: number): Date[][] {
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const semanas: Date[][] = [];
  let actual: Date[] = [];

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const d = new Date(Date.UTC(anio, mes - 1, dia));
    const dow = d.getUTCDay(); // 0 domingo … 6 sábado
    if (dow === 0 || dow === 6) continue; // fin de semana: no se opera

    // Lunes abre semana nueva, salvo que sea el primer día hábil del mes.
    if (dow === 1 && actual.length > 0) {
      semanas.push(actual);
      actual = [];
    }
    actual.push(d);
  }
  if (actual.length > 0) semanas.push(actual);

  return semanas;
}

/** Clave estable de un día: `YYYY-MM-DD` en UTC, igual que en la base. */
export function claveFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi"] as const;

/** Etiqueta corta del día (Lu…Vi) a partir de la fecha. */
export function etiquetaDia(d: Date): string {
  return DIAS_SEMANA[d.getUTCDay() - 1] ?? "";
}

/** Color de estado del chip de insight. Estado, nunca identidad de serie. */
export function colorInsight(insight: Insight): string {
  switch (insight) {
    case "Operativa eficiente ✅":
    case "Día perfecto 🎯":
      return "var(--status-good)";
    case "Revisar errores ⚠️":
    case "Día negativo ❌":
      return "var(--status-critical)";
    case "Buen desempeño 👍":
    case "Resultado aceptable ⚖️":
      return "var(--series-1)";
    case "Sin operaciones":
      return "var(--text-muted)";
    default:
      return "var(--status-warning)";
  }
}
