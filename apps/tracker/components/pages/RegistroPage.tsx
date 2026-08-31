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
  ChipInsight,
  EstadoGuardado,
  InputNum,
  KpiStrip,
  SectionLabel,
  Widget,
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="m-0 text-[length:var(--text-md)] text-[var(--text-secondary)]">
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
          <Widget key={i} title={`Semana ${i + 1}`}>
            <div className="cj-table-wrap">
              <table className="min-w-[720px]">
                <thead>
                  <tr>
                    <th className="w-14">Día</th>
                    <th className="w-16">Fecha</th>
                    <th>Ops</th>
                    <th style={{ color: "var(--status-good)" }}>Ganadoras</th>
                    <th style={{ color: "var(--status-critical)" }}>Perdedoras</th>
                    <th style={{ color: "var(--status-good)" }}>Pts +</th>
                    <th style={{ color: "var(--status-critical)" }}>Pts −</th>
                    <th>Insight</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ fecha, d, dato }) => {
                    const calc = calcDia(dato);
                    return (
                      <tr key={fecha}>
                        <td className="font-mono font-semibold">{etiquetaDia(d)}</td>
                        <td className="font-mono text-[length:var(--text-sm)] text-[var(--text-muted)]">
                          {fecha.slice(8, 10)}/{fecha.slice(5, 7)}
                        </td>
                        <td className="!py-1 pr-2">
                          <InputNum
                            ariaLabel={`Operaciones del ${fecha}`}
                            value={dato.ops}
                            onChange={(v) => editar(fecha, "ops", v)}
                          />
                        </td>
                        <td className="!py-1 pr-2">
                          <InputNum
                            ariaLabel={`Ganadoras del ${fecha}`}
                            value={dato.ganadoras}
                            onChange={(v) => editar(fecha, "ganadoras", v)}
                          />
                        </td>
                        <td className="!py-1 pr-2">
                          <InputNum
                            ariaLabel={`Perdedoras del ${fecha}`}
                            value={dato.perdedoras}
                            onChange={(v) => editar(fecha, "perdedoras", v)}
                          />
                        </td>
                        <td className="!py-1 pr-2">
                          <InputNum
                            ariaLabel={`Puntos a favor del ${fecha}`}
                            value={dato.ptsPos}
                            step={0.25}
                            onChange={(v) => editar(fecha, "ptsPos", v)}
                          />
                        </td>
                        <td className="!py-1 pr-2">
                          <InputNum
                            ariaLabel={`Puntos en contra del ${fecha}`}
                            value={dato.ptsNeg}
                            step={0.25}
                            onChange={(v) => editar(fecha, "ptsNeg", v)}
                          />
                        </td>
                        <td>
                          <ChipInsight insight={calc.insight} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-[length:var(--text-sm)]"
              style={{ borderLeft: "3px solid var(--gold)" }}
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
          </Widget>
        );
      })}

      {stats && stats.totalOps > 0 && (
        <div className="space-y-2">
          <SectionLabel>Resumen del mes</SectionLabel>
          <KpiStrip
            items={[
              { label: "Operaciones", value: String(stats.totalOps) },
              {
                label: "Tasa de éxito",
                value: fmtTasa(stats.tasa),
                sub: `${stats.totalGan} ganadoras`,
                valueColor: colorTasa(stats.tasa),
              },
              {
                label: "Balance de puntos",
                value: fmtPuntos(stats.totalBal),
                sub: `R/B: ${fmtRatio(stats.rr)}`,
                valueColor: colorSigno(stats.totalBal),
              },
              { label: "Prom. ganancia", value: `${stats.avgWin.toFixed(2)} pts` },
              { label: "Prom. pérdida", value: `${stats.avgLoss.toFixed(2)} pts` },
            ]}
          />
        </div>
      )}
    </div>
  );
}
