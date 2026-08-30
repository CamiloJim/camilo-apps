"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  calcDia,
  claveFecha,
  etiquetaDia,
  getSemanas,
  getStatsMes,
  type ConfigMes,
  type DiaInput,
} from "@/lib/trading/calc";
import { guardarDia, type MapaDias } from "@/lib/trading/data";
import {
  Card,
  ChipInsight,
  EstadoGuardado,
  InputNum,
  Kpi,
  SectionLabel,
  colorSigno,
  colorTasa,
  fmtPuntos,
  fmtRatio,
  fmtTasa,
} from "../ui";

const DIA_VACIO: DiaInput = { ops: 0, ganadoras: 0, perdedoras: 0, ptsPos: 0, ptsNeg: 0 };

/** Espera antes de guardar: no se escribe en la base en cada tecla. */
const DEBOUNCE_MS = 800;

export function RegistroPage({
  anio,
  mes,
  dias,
  setDias,
  cfg,
}: {
  anio: number;
  mes: number;
  dias: MapaDias;
  setDias: React.Dispatch<React.SetStateAction<MapaDias>>;
  cfg: ConfigMes;
}) {
  const [estado, setEstado] = useState<"idle" | "guardando" | "guardado">("idle");
  const pendientes = useRef<Map<string, DiaInput>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vaciar = useCallback(async () => {
    const lote = new Map(pendientes.current);
    pendientes.current.clear();
    if (lote.size === 0) return;

    setEstado("guardando");
    await Promise.all([...lote.entries()].map(([fecha, d]) => guardarDia(fecha, d)));
    setEstado("guardado");
    setTimeout(() => setEstado("idle"), 1500);
  }, []);

  // Si el usuario cierra o cambia de pestaña con cambios sin guardar, se
  // fuerza el guardado en vez de perderlos.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void vaciar();
    };
  }, [vaciar]);

  const editar = useCallback(
    (fecha: string, campo: keyof DiaInput, valor: number) => {
      setDias((prev) => {
        const actual = prev[fecha] ?? DIA_VACIO;
        const siguiente = { ...actual, [campo]: valor };
        pendientes.current.set(fecha, siguiente);
        return { ...prev, [fecha]: siguiente };
      });

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void vaciar(), DEBOUNCE_MS);
    },
    [setDias, vaciar]
  );

  const semanas = getSemanas(anio, mes);
  const delMes = Object.entries(dias)
    .filter(([f]) => Number(f.slice(5, 7)) === mes && Number(f.slice(0, 4)) === anio)
    .map(([, d]) => d);
  const stats = getStatsMes(delMes, cfg);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          Ingresa las operaciones día a día. Solo completa los días con actividad.
        </p>
        <EstadoGuardado estado={estado} />
      </div>

      {semanas.map((semana, i) => {
        const filas = semana.map((d) => {
          const fecha = claveFecha(d);
          return { fecha, d, dato: dias[fecha] ?? DIA_VACIO };
        });
        const wOps = filas.reduce((a, f) => a + f.dato.ops, 0);
        const wGan = filas.reduce((a, f) => a + f.dato.ganadoras, 0);
        const wPer = filas.reduce((a, f) => a + f.dato.perdedoras, 0);
        const wPos = filas.reduce((a, f) => a + f.dato.ptsPos, 0);
        const wNeg = filas.reduce((a, f) => a + f.dato.ptsNeg, 0);
        const wBal = wPos - wNeg;
        const wTasa = wOps > 0 ? (wGan / wOps) * 100 : 0;

        return (
          <Card key={i}>
            <SectionLabel>Semana {i + 1}</SectionLabel>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[0.65rem] uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="w-14 py-1.5 font-semibold">Día</th>
                    <th className="w-16 py-1.5 font-semibold">Fecha</th>
                    <th className="py-1.5 font-semibold">Ops</th>
                    <th className="py-1.5 font-semibold" style={{ color: "var(--status-good)" }}>
                      Ganadoras
                    </th>
                    <th
                      className="py-1.5 font-semibold"
                      style={{ color: "var(--status-critical)" }}
                    >
                      Perdedoras
                    </th>
                    <th className="py-1.5 font-semibold" style={{ color: "var(--status-good)" }}>
                      Pts +
                    </th>
                    <th
                      className="py-1.5 font-semibold"
                      style={{ color: "var(--status-critical)" }}
                    >
                      Pts −
                    </th>
                    <th className="py-1.5 font-semibold">Insight</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ fecha, d, dato }) => {
                    const calc = calcDia(dato);
                    return (
                      <tr key={fecha} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-1.5 font-mono font-semibold">{etiquetaDia(d)}</td>
                        <td className="py-1.5 font-mono text-xs text-[var(--text-muted)]">
                          {fecha.slice(8, 10)}/{fecha.slice(5, 7)}
                        </td>
                        <td className="py-1 pr-2">
                          <InputNum
                            ariaLabel={`Operaciones del ${fecha}`}
                            value={dato.ops}
                            onChange={(v) => editar(fecha, "ops", v)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <InputNum
                            ariaLabel={`Ganadoras del ${fecha}`}
                            value={dato.ganadoras}
                            onChange={(v) => editar(fecha, "ganadoras", v)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <InputNum
                            ariaLabel={`Perdedoras del ${fecha}`}
                            value={dato.perdedoras}
                            onChange={(v) => editar(fecha, "perdedoras", v)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <InputNum
                            ariaLabel={`Puntos a favor del ${fecha}`}
                            value={dato.ptsPos}
                            step={0.25}
                            onChange={(v) => editar(fecha, "ptsPos", v)}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <InputNum
                            ariaLabel={`Puntos en contra del ${fecha}`}
                            value={dato.ptsNeg}
                            step={0.25}
                            onChange={(v) => editar(fecha, "ptsNeg", v)}
                          />
                        </td>
                        <td className="py-1.5">
                          <ChipInsight insight={calc.insight} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs"
              style={{ borderLeft: "3px solid var(--series-1)" }}
            >
              <span className="text-[var(--text-muted)]">SEMANA {i + 1}</span>
              <span>
                Ops: <b>{wOps}</b>
              </span>
              <span style={{ color: "var(--status-good)" }}>✓ {wGan}</span>
              <span style={{ color: "var(--status-critical)" }}>✗ {wPer}</span>
              <span>
                Tasa: <b style={{ color: colorTasa(wTasa) }}>{fmtTasa(wTasa, 0)}</b>
              </span>
              <span>
                Pts +{wPos.toFixed(2)} / −{wNeg.toFixed(2)}
              </span>
              <span style={{ color: colorSigno(wBal) }}>
                Balance: <b>{fmtPuntos(wBal)}</b>
              </span>
            </div>
          </Card>
        );
      })}

      {stats && stats.totalOps > 0 && (
        <div>
          <SectionLabel>Resumen del mes</SectionLabel>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Operaciones" value={String(stats.totalOps)} />
            <Kpi
              label="Tasa de éxito"
              value={fmtTasa(stats.tasa)}
              sub={`${stats.totalGan} ganadoras`}
              valueColor={colorTasa(stats.tasa)}
            />
            <Kpi
              label="Balance de puntos"
              value={fmtPuntos(stats.totalBal)}
              sub={`R/B: ${fmtRatio(stats.rr)}`}
              valueColor={colorSigno(stats.totalBal)}
            />
            <Kpi label="Prom. ganancia" value={`${stats.avgWin.toFixed(2)} pts`} />
            <Kpi label="Prom. pérdida" value={`${stats.avgLoss.toFixed(2)} pts`} />
          </div>
        </div>
      )}
    </div>
  );
}
