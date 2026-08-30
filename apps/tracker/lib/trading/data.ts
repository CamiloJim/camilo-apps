// Acceso a Supabase para el Trading Tracker.
//
// La RLS de trading_days / trading_config ya acota cada consulta al usuario de
// la sesión, así que aquí no se filtra por user_id al leer: hacerlo sería
// redundante y daría una falsa sensación de que la seguridad vive en el
// cliente. Al escribir sí hace falta, porque la columna es NOT NULL.
import { createBrowserSupabaseClient } from "@camilo-apps/supabase/client";
import type { ConfigMes, DiaInput } from "./calc";

/** Fila tal como vive en la base. */
interface FilaDia {
  fecha: string;
  ops: number;
  ganadoras: number;
  perdedoras: number;
  pts_pos: number;
  pts_neg: number;
}

interface FilaConfig {
  anio: number;
  mes: number;
  balance_inicial: number;
  contratos: number;
  comision: number;
}

export const CONFIG_POR_DEFECTO: ConfigMes = {
  balanceInicial: 1000,
  contratos: 1,
  comision: 5,
};

/** Días indexados por `YYYY-MM-DD`. */
export type MapaDias = Record<string, DiaInput>;

function aDiaInput(f: FilaDia): DiaInput {
  return {
    ops: f.ops,
    ganadoras: f.ganadoras,
    perdedoras: f.perdedoras,
    // numeric de Postgres llega como string por supabase-js; Number() lo
    // normaliza. Sin esto, "8.00" + "7.50" concatenaría en vez de sumar.
    ptsPos: Number(f.pts_pos),
    ptsNeg: Number(f.pts_neg),
  };
}

function rangoDelMes(anio: number, mes: number): [string, string] {
  const desde = new Date(Date.UTC(anio, mes - 1, 1)).toISOString().slice(0, 10);
  const hasta = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  return [desde, hasta];
}

/** Todos los días de un mes. */
export async function cargarDiasDelMes(anio: number, mes: number): Promise<MapaDias> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return {};

  const [desde, hasta] = rangoDelMes(anio, mes);
  const { data, error } = await supabase
    .from("trading_days")
    .select("fecha, ops, ganadoras, perdedoras, pts_pos, pts_neg")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  if (error || !data) return {};

  const out: MapaDias = {};
  for (const f of data as FilaDia[]) out[f.fecha] = aDiaInput(f);
  return out;
}

/** Todos los días del año, para el resumen anual. */
export async function cargarDiasDelAnio(anio: number): Promise<Record<string, DiaInput>> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("trading_days")
    .select("fecha, ops, ganadoras, perdedoras, pts_pos, pts_neg")
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31`);

  if (error || !data) return {};

  const out: Record<string, DiaInput> = {};
  for (const f of data as FilaDia[]) out[f.fecha] = aDiaInput(f);
  return out;
}

/** Config de todos los meses del año, indexada por número de mes. */
export async function cargarConfigsDelAnio(anio: number): Promise<Record<number, ConfigMes>> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("trading_config")
    .select("anio, mes, balance_inicial, contratos, comision")
    .eq("anio", anio);

  if (error || !data) return {};

  const out: Record<number, ConfigMes> = {};
  for (const f of data as FilaConfig[]) {
    out[f.mes] = {
      balanceInicial: Number(f.balance_inicial),
      contratos: f.contratos,
      comision: Number(f.comision),
    };
  }
  return out;
}

/**
 * Guarda un día.
 *
 * Un día en cero no se guarda: se BORRA si existía. Así la tabla contiene solo
 * días con actividad real y no se llena de filas vacías por el mero hecho de
 * que el formulario las muestre.
 */
export async function guardarDia(fecha: string, dia: DiaInput): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return;

  const vacio =
    dia.ops === 0 &&
    dia.ganadoras === 0 &&
    dia.perdedoras === 0 &&
    dia.ptsPos === 0 &&
    dia.ptsNeg === 0;

  if (vacio) {
    await supabase.from("trading_days").delete().eq("fecha", fecha);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("trading_days").upsert(
    {
      user_id: user.id,
      fecha,
      ops: dia.ops,
      ganadoras: dia.ganadoras,
      perdedoras: dia.perdedoras,
      pts_pos: dia.ptsPos,
      pts_neg: dia.ptsNeg,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,fecha" }
  );
}

export async function guardarConfig(
  anio: number,
  mes: number,
  cfg: ConfigMes
): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("trading_config").upsert(
    {
      user_id: user.id,
      anio,
      mes,
      balance_inicial: cfg.balanceInicial,
      contratos: cfg.contratos,
      comision: cfg.comision,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,anio,mes" }
  );
}

/** Borra TODO lo del año. Solo lo llama la pantalla de configuración, con confirmación. */
export async function borrarAnio(anio: number): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return;

  await supabase
    .from("trading_days")
    .delete()
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31`);
  await supabase.from("trading_config").delete().eq("anio", anio);
}

/**
 * Formato de respaldo del Streamlit original: un objeto por mes (1-12) con
 * `config` y `trades` indexados por fecha. Se conserva idéntico para que los
 * JSON que Camilo ya descargó sigan sirviendo.
 */
export interface RespaldoJson {
  [mes: string]: {
    config: { balance_inicial: number; contratos: number; comision: number };
    trades: Record<
      string,
      { ops: number; ganadoras: number; perdedoras: number; pts_pos: number; pts_neg: number }
    >;
  };
}

export function aRespaldoJson(
  dias: Record<string, DiaInput>,
  configs: Record<number, ConfigMes>
): RespaldoJson {
  const out: RespaldoJson = {};
  for (let m = 1; m <= 12; m++) {
    const cfg = configs[m] ?? CONFIG_POR_DEFECTO;
    out[String(m)] = {
      config: {
        balance_inicial: cfg.balanceInicial,
        contratos: cfg.contratos,
        comision: cfg.comision,
      },
      trades: {},
    };
  }
  for (const [fecha, d] of Object.entries(dias)) {
    const mes = String(Number(fecha.slice(5, 7)));
    if (!out[mes]) continue;
    out[mes].trades[fecha] = {
      ops: d.ops,
      ganadoras: d.ganadoras,
      perdedoras: d.perdedoras,
      pts_pos: d.ptsPos,
      pts_neg: d.ptsNeg,
    };
  }
  return out;
}

/** Importa un respaldo. Sobrescribe lo que exista en las mismas fechas. */
export async function importarRespaldo(anio: number, json: RespaldoJson): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const filasDias = [];
  const filasCfg = [];

  for (const [mesStr, bloque] of Object.entries(json)) {
    const mes = Number(mesStr);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) continue;

    if (bloque.config) {
      filasCfg.push({
        user_id: user.id,
        anio,
        mes,
        balance_inicial: bloque.config.balance_inicial,
        contratos: bloque.config.contratos,
        comision: bloque.config.comision,
        updated_at: new Date().toISOString(),
      });
    }

    for (const [fecha, t] of Object.entries(bloque.trades ?? {})) {
      // Los días en cero no se importan: son ruido del formulario original.
      if (!t.ops) continue;
      // Un respaldo con ops que no cuadran violaría el CHECK de la tabla y
      // haría fallar toda la importación: se descarta esa fila y sigue.
      if (t.ganadoras + t.perdedoras !== t.ops) continue;
      filasDias.push({
        user_id: user.id,
        fecha,
        ops: t.ops,
        ganadoras: t.ganadoras,
        perdedoras: t.perdedoras,
        pts_pos: t.pts_pos,
        pts_neg: t.pts_neg,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (filasCfg.length > 0) {
    await supabase.from("trading_config").upsert(filasCfg, { onConflict: "user_id,anio,mes" });
  }
  if (filasDias.length > 0) {
    await supabase.from("trading_days").upsert(filasDias, { onConflict: "user_id,fecha" });
  }
  return filasDias.length;
}
