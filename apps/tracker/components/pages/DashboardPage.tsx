"use client";

import { calcDia, type ConfigMes, type DiaCalculado, getStatsMes } from "@/lib/trading/calc";
import type { MapaDias } from "@/lib/trading/data";
import {
  CHART_COLOR,
  Card,
  ChartLegend,
  ChipInsight,
  ComboChart,
  DivergingStackedChart,
  DonutChart,
  Gauge,
  KpiStrip,
  LineChart,
  Tabla,
  Td,
  Th,
  Widget,
  WidgetGrid,
  colorRatio,
  colorSigno,
  colorTasa,
  fmtPuntos,
  fmtRatio,
  fmtTasa,
  fmtUsd,
} from "../ui";

interface FilaDia extends DiaCalculado {
  fecha: string;
  etiqueta: string;
}

export function DashboardPage({
  anio,
  mes,
  dias,
  cfg,
}: {
  anio: number;
  mes: number;
  dias: MapaDias;
  cfg: ConfigMes;
}) {
  const filas: FilaDia[] = Object.entries(dias)
    .filter(([f]) => Number(f.slice(0, 4)) === anio && Number(f.slice(5, 7)) === mes)
    .filter(([, d]) => d.ops > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, d]) => ({
      ...calcDia(d),
      fecha,
      etiqueta: `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`,
    }));

  const stats = getStatsMes(
    filas.map((f) => ({
      ops: f.ops,
      ganadoras: f.ganadoras,
      perdedoras: f.perdedoras,
      ptsPos: f.ptsPos,
      ptsNeg: f.ptsNeg,
    })),
    cfg
  );

  if (!stats || stats.totalOps === 0) {
    return (
      <Card>
        <p className="text-[length:var(--text-md)] text-[var(--text-secondary)]">
          Aún no hay operaciones registradas este mes. Ve a <b>Registro</b> para empezar.
        </p>
      </Card>
    );
  }

  // Curva de equidad: balance acumulado día a día. Con reduce en vez de una
  // variable mutable, para no reasignar durante el render.
  const equidad = filas.reduce<number[]>((acc, f) => {
    const previo = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(Number((previo + f.balance).toFixed(2)));
    return acc;
  }, []);

  const etiquetas = filas.map((f) => f.etiqueta);

  const conteoInsights = filas.reduce<Record<string, number>>((acc, f) => {
    acc[f.insight] = (acc[f.insight] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          {
            label: "Operaciones",
            value: String(stats.totalOps),
            sub: `${stats.diasActivos} días activos`,
            spark: filas.map((f) => f.ops),
          },
          {
            label: "Tasa de éxito",
            value: fmtTasa(stats.tasa),
            sub: `${stats.totalGan} ✓ · ${stats.totalPer} ✗`,
            valueColor: colorTasa(stats.tasa),
            spark: filas.map((f) => f.tasa),
          },
          {
            label: "Balance de puntos",
            value: fmtPuntos(stats.totalBal),
            sub: `+${stats.totalPtsPos.toFixed(2)} / −${stats.totalPtsNeg.toFixed(2)}`,
            valueColor: colorSigno(stats.totalBal),
            spark: equidad,
          },
          {
            label: "Riesgo / beneficio",
            value: fmtRatio(stats.rr),
            sub: `win ${stats.avgWin.toFixed(2)} · loss ${stats.avgLoss.toFixed(2)}`,
            valueColor: colorRatio(stats.rr),
            spark: filas.map((f) => f.rr),
          },
          {
            label: "Resultado (USD)",
            value: fmtUsd(stats.resultadoUsd),
            sub: `Comisiones: −${fmtUsd(stats.comisiones)}`,
            valueColor: colorSigno(stats.resultadoUsd),
          },
          {
            label: "Retorno mensual",
            value: `${stats.retornoPct >= 0 ? "+" : ""}${stats.retornoPct.toFixed(2)}%`,
            sub: `Sobre ${fmtUsd(stats.balInicial)}`,
            valueColor: colorSigno(stats.retornoPct),
          },
        ]}
      />

      <WidgetGrid>
        <Widget
          title="Curva de equidad"
          meta="Puntos acumulados en el mes"
          note="Acumula el saldo de puntos de cada día. Es la única vista donde se ve si el mes va sumando o devolviendo lo ganado."
        >
          <LineChart
            area
            labels={etiquetas}
            series={[{ name: "Acumulado", color: CHART_COLOR.accent, values: equidad }]}
            fmt={(v) => fmtPuntos(v, 0)}
            height={250}
          />
        </Widget>

        <Widget title="Operaciones por día" span={6}>
          <ComboChart
            data={filas.map((f) => ({
              label: f.etiqueta,
              values: [f.ganadoras, f.perdedoras],
            }))}
            keys={["Ganadoras", "Perdedoras"]}
            colors={[CHART_COLOR.win, CHART_COLOR.loss]}
            fmt={(v) => String(Math.round(v))}
          />
          <ChartLegend
            items={[
              { label: "Ganadoras", color: CHART_COLOR.win },
              { label: "Perdedoras", color: CHART_COLOR.loss },
            ]}
          />
        </Widget>

        <Widget
          title="Tasa de éxito por día"
          meta="%"
          span={6}
          note="El color de cada barra es el veredicto del día: verde por encima del 50 %, ámbar entre 40 y 50, rojo por debajo."
        >
          <ComboChart
            data={filas.map((f) => ({ label: f.etiqueta, values: [f.tasa] }))}
            keys={["Tasa"]}
            colors={[CHART_COLOR.accent]}
            barColorFn={(i) => colorTasa(filas[i].tasa)}
            axisMax={100}
            fmt={(v) => `${v.toFixed(0)}%`}
            refLines={[
              { value: 50, label: "50 % objetivo", color: "var(--status-good)" },
              { value: 40, label: "40 % mínimo", color: "var(--status-warning)" },
            ]}
          />
        </Widget>

        <Widget
          title="Ratio riesgo / beneficio"
          span={6}
          note="Cuánto se gana por cada punto perdido. Por debajo de 1 el mes pierde dinero aunque la tasa de acierto sea alta."
        >
          <LineChart
            labels={etiquetas}
            series={[{ name: "R/B", color: CHART_COLOR.comparison, values: filas.map((f) => f.rr) }]}
            fmt={(v) => v.toFixed(1)}
            refLines={[
              { value: 1.5, label: "1,5 objetivo", color: "var(--status-good)" },
              { value: 1, label: "1 mínimo", color: "var(--status-warning)" },
            ]}
          />
        </Widget>

        <Widget
          title="Distribución de puntos"
          meta="A favor arriba, en contra abajo"
          span={6}
          note="Los dos brutos del mismo día en una sola columna partida por el cero: el saldo neto se ve sin restar mentalmente."
        >
          <DivergingStackedChart
            data={filas.map((f) => ({
              label: f.etiqueta,
              positive: f.ptsPos,
              negative: f.ptsNeg,
            }))}
            fmt={(v) => v.toFixed(0)}
            positiveLabel="Puntos a favor"
            negativeLabel="Puntos en contra"
          />
        </Widget>

        <Widget title="Tasa de éxito global" span={4}>
          <Gauge
            label="Objetivo 50 %"
            valor={stats.tasa}
            max={100}
            color={colorTasa(stats.tasa)}
            formato={(v) => `${v.toFixed(1)}%`}
          />
        </Widget>

        <Widget title="Ratio R/B" span={4}>
          <Gauge
            label="Objetivo 1,5"
            valor={stats.rr}
            max={5}
            color={colorRatio(stats.rr)}
            formato={(v) => v.toFixed(2)}
          />
        </Widget>

        <Widget title="Ganadoras vs perdedoras" span={4}>
          <DonutChart
            data={[
              { label: "Ganadoras", value: stats.totalGan, color: CHART_COLOR.win },
              { label: "Perdedoras", value: stats.totalPer, color: CHART_COLOR.loss },
            ]}
            centerLabel={String(stats.totalOps)}
            centerSub="operaciones"
            fmt={(v) => String(Math.round(v))}
          />
        </Widget>

        <Widget title="Detalle diario" meta={`${filas.length} días con operaciones`}>
          <Tabla>
            <thead>
              <tr>
                <Th num={false}>Fecha</Th>
                <Th num>Ops</Th>
                <Th num>Gan.</Th>
                <Th num>Perd.</Th>
                <Th num>Pts +</Th>
                <Th num>Pts −</Th>
                <Th num>Balance</Th>
                <Th num>Tasa</Th>
                <Th num>R/B</Th>
                <Th num={false}>Insight</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.fecha}>
                  <Td num={false}>{f.etiqueta}</Td>
                  <Td>{f.ops}</Td>
                  <Td>{f.ganadoras}</Td>
                  <Td>{f.perdedoras}</Td>
                  <Td>{f.ptsPos.toFixed(2)}</Td>
                  <Td>{f.ptsNeg.toFixed(2)}</Td>
                  <Td className="font-semibold">
                    <span style={{ color: colorSigno(f.balance) }}>{fmtPuntos(f.balance)}</span>
                  </Td>
                  <Td>{fmtTasa(f.tasa)}</Td>
                  <Td>{fmtRatio(f.rr)}</Td>
                  <td>
                    <ChipInsight insight={f.insight} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Widget>

        <Widget title="Análisis de insights" meta="Cuántos días cayó en cada diagnóstico">
          <div className="flex flex-wrap gap-3">
            {Object.entries(conteoInsights)
              .sort((a, b) => b[1] - a[1])
              .map(([insight, n]) => (
                <div key={insight} className="flex items-center gap-2">
                  <ChipInsight insight={insight as FilaDia["insight"]} />
                  <span className="font-mono text-[length:var(--text-sm)] text-[var(--text-secondary)]">
                    {n} {n === 1 ? "día" : "días"}
                  </span>
                </div>
              ))}
          </div>
        </Widget>
      </WidgetGrid>
    </div>
  );
}
