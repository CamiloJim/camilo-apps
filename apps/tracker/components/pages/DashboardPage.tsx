"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Area,
  AreaChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { calcDia, type ConfigMes, type DiaCalculado, getStatsMes } from "@/lib/trading/calc";
import type { MapaDias } from "@/lib/trading/data";
import { Gauge } from "../Gauge";
import {
  Card,
  ChipInsight,
  Kpi,
  SectionLabel,
  Tabla,
  Td,
  Th,
  colorRatio,
  colorSigno,
  colorTasa,
  fmtPuntos,
  fmtRatio,
  fmtTasa,
  fmtTooltip,
  fmtUsd,
} from "../ui";

const ejes = { grid: "var(--border)", axis: "var(--text-muted)" };

const tooltipStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
} as const;

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
        <p className="text-sm text-[var(--text-secondary)]">
          Aún no hay operaciones registradas este mes. Ve a <b>Registro</b> para empezar.
        </p>
      </Card>
    );
  }

  // Curva de equidad: balance acumulado día a día. Con reduce en vez de una
  // variable mutable, para no reasignar durante el render.
  const equidad = filas.reduce<{ etiqueta: string; acumulado: number }[]>((acc, f) => {
    const previo = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
    acc.push({ etiqueta: f.etiqueta, acumulado: Number((previo + f.balance).toFixed(2)) });
    return acc;
  }, []);

  const conteoInsights = filas.reduce<Record<string, number>>((acc, f) => {
    acc[f.insight] = (acc[f.insight] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Operaciones totales"
          value={String(stats.totalOps)}
          sub={`${stats.diasActivos} días activos`}
        />
        <Kpi
          label="Tasa de éxito"
          value={fmtTasa(stats.tasa)}
          sub={`${stats.totalGan} ✓ · ${stats.totalPer} ✗`}
          valueColor={colorTasa(stats.tasa)}
        />
        <Kpi
          label="Balance de puntos"
          value={fmtPuntos(stats.totalBal)}
          sub={`+${stats.totalPtsPos.toFixed(2)} / −${stats.totalPtsNeg.toFixed(2)}`}
          valueColor={colorSigno(stats.totalBal)}
        />
        <Kpi
          label="Riesgo / beneficio"
          value={fmtRatio(stats.rr)}
          sub={`win ${stats.avgWin.toFixed(2)} · loss ${stats.avgLoss.toFixed(2)}`}
          valueColor={colorRatio(stats.rr)}
        />
        <Kpi
          label="Resultado (USD)"
          value={fmtUsd(stats.resultadoUsd)}
          sub={`Comisiones: −${fmtUsd(stats.comisiones)}`}
          valueColor={colorSigno(stats.resultadoUsd)}
        />
        <Kpi
          label="Retorno mensual"
          value={`${stats.retornoPct >= 0 ? "+" : ""}${stats.retornoPct.toFixed(2)}%`}
          sub={`Sobre ${fmtUsd(stats.balInicial)}`}
          valueColor={colorSigno(stats.retornoPct)}
        />
      </div>

      <Card>
        <SectionLabel>Curva de equidad (puntos acumulados)</SectionLabel>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={equidad}>
            <CartesianGrid stroke={ejes.grid} vertical={false} />
            <XAxis dataKey="etiqueta" stroke={ejes.axis} fontSize={11} />
            <YAxis stroke={ejes.axis} fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip((v) => `${v.toFixed(2)} pts`, "Acumulado")} />
            <ReferenceLine y={0} stroke={ejes.grid} />
            <Area
              type="monotone"
              dataKey="acumulado"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="var(--series-1)"
              fillOpacity={0.12}
              dot={{ r: 3 }}
              name="Acumulado"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionLabel>Operaciones por día</SectionLabel>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={filas}>
              <CartesianGrid stroke={ejes.grid} vertical={false} />
              <XAxis dataKey="etiqueta" stroke={ejes.axis} fontSize={11} />
              <YAxis stroke={ejes.axis} fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke={ejes.grid} />
              <Bar
                dataKey="ganadoras"
                name="Ganadoras"
                fill="var(--series-3)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="perdedoras"
                name="Perdedoras"
                fill="var(--series-8)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionLabel>Tasa de éxito por día (%)</SectionLabel>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={filas}>
              <CartesianGrid stroke={ejes.grid} vertical={false} />
              <XAxis dataKey="etiqueta" stroke={ejes.axis} fontSize={11} />
              <YAxis stroke={ejes.axis} fontSize={11} domain={[0, 110]} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={fmtTooltip((v) => `${v.toFixed(1)}%`, "Tasa")}
              />
              <ReferenceLine
                y={50}
                stroke="var(--status-good)"
                strokeDasharray="3 3"
                label={{ value: "50%", fill: "var(--text-muted)", fontSize: 10, position: "right" }}
              />
              <ReferenceLine
                y={40}
                stroke="var(--status-warning)"
                strokeDasharray="3 3"
                label={{ value: "40%", fill: "var(--text-muted)", fontSize: 10, position: "right" }}
              />
              <Bar dataKey="tasa" name="Tasa" radius={[4, 4, 0, 0]}>
                {filas.map((f) => (
                  <Cell key={f.fecha} fill={colorTasa(f.tasa)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionLabel>Ratio riesgo / beneficio</SectionLabel>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={filas}>
              <CartesianGrid stroke={ejes.grid} vertical={false} />
              <XAxis dataKey="etiqueta" stroke={ejes.axis} fontSize={11} />
              <YAxis stroke={ejes.axis} fontSize={11} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={fmtTooltip((v) => v.toFixed(2), "R/B")}
              />
              <ReferenceLine
                y={1.5}
                stroke="var(--status-good)"
                strokeDasharray="3 3"
                label={{
                  value: "1.5 objetivo",
                  fill: "var(--text-muted)",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <ReferenceLine y={1} stroke="var(--status-warning)" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="rr"
                name="R/B"
                stroke="var(--series-7)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionLabel>Distribución de puntos</SectionLabel>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={filas} stackOffset="sign">
              <CartesianGrid stroke={ejes.grid} vertical={false} />
              <XAxis dataKey="etiqueta" stroke={ejes.axis} fontSize={11} />
              <YAxis stroke={ejes.axis} fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke={ejes.grid} />
              <Bar
                dataKey="ptsPos"
                name="Pts +"
                fill="var(--series-3)"
                stackId="pts"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey={(f: FilaDia) => -f.ptsNeg}
                name="Pts −"
                fill="var(--series-8)"
                stackId="pts"
                radius={[0, 0, 4, 4]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <Gauge
            label="Tasa de éxito global"
            valor={stats.tasa}
            max={100}
            color={colorTasa(stats.tasa)}
            formato={(v) => `${v.toFixed(1)}%`}
          />
        </Card>
        <Card>
          <Gauge
            label="Ratio R/B"
            valor={stats.rr}
            max={5}
            color={colorRatio(stats.rr)}
            formato={(v) => v.toFixed(2)}
          />
        </Card>
        <Card>
          <SectionLabel>Ganadoras vs perdedoras</SectionLabel>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={[
                  { name: "Ganadoras", value: stats.totalGan },
                  { name: "Perdedoras", value: stats.totalPer },
                ]}
                dataKey="value"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                stroke="var(--surface-1)"
                strokeWidth={2}
              >
                <Cell fill="var(--series-3)" />
                <Cell fill="var(--series-8)" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionLabel>Detalle diario</SectionLabel>
        <Tabla>
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
              <Th>Fecha</Th>
              <Th>Ops</Th>
              <Th>Gan.</Th>
              <Th>Perd.</Th>
              <Th>Pts +</Th>
              <Th>Pts −</Th>
              <Th>Balance</Th>
              <Th>Tasa</Th>
              <Th>R/B</Th>
              <Th>Insight</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.fecha} className="border-b border-[var(--border)] last:border-0">
                <Td>{f.etiqueta}</Td>
                <Td>{f.ops}</Td>
                <Td>{f.ganadoras}</Td>
                <Td>{f.perdedoras}</Td>
                <Td>{f.ptsPos.toFixed(2)}</Td>
                <Td>{f.ptsNeg.toFixed(2)}</Td>
                <Td className="font-semibold" >
                  <span style={{ color: colorSigno(f.balance) }}>{fmtPuntos(f.balance)}</span>
                </Td>
                <Td>{fmtTasa(f.tasa)}</Td>
                <Td>{fmtRatio(f.rr)}</Td>
                <td className="py-1.5">
                  <ChipInsight insight={f.insight} />
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Card>

      <Card>
        <SectionLabel>Análisis de insights</SectionLabel>
        <div className="flex flex-wrap gap-3">
          {Object.entries(conteoInsights)
            .sort((a, b) => b[1] - a[1])
            .map(([insight, n]) => (
              <div key={insight} className="flex items-center gap-2">
                <ChipInsight insight={insight as FilaDia["insight"]} />
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  {n} {n === 1 ? "día" : "días"}
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
