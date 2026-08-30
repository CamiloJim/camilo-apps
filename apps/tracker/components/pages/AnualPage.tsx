"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { MESES, getStatsMes, type ConfigMes, type StatsMes } from "@/lib/trading/calc";
import { CONFIG_POR_DEFECTO, type MapaDias } from "@/lib/trading/data";
import {
  Card,
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

interface FilaMes extends StatsMes {
  mes: number;
  nombre: string;
}

export function AnualPage({
  dias,
  configs,
}: {
  dias: MapaDias;
  configs: Record<number, ConfigMes>;
}) {
  const porMes: FilaMes[] = [];

  for (let m = 1; m <= 12; m++) {
    const delMes = Object.entries(dias)
      .filter(([f]) => Number(f.slice(5, 7)) === m)
      .map(([, d]) => d)
      .filter((d) => d.ops > 0);

    const s = getStatsMes(delMes, configs[m] ?? CONFIG_POR_DEFECTO);
    if (s && s.totalOps > 0) {
      porMes.push({ ...s, mes: m, nombre: MESES[m - 1] });
    }
  }

  if (porMes.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--text-secondary)]">
          No hay datos registrados todavía. Empieza en <b>Registro</b>.
        </p>
      </Card>
    );
  }

  const totalOps = porMes.reduce((a, m) => a + m.totalOps, 0);
  const totalGan = porMes.reduce((a, m) => a + m.totalGan, 0);
  const totalBal = porMes.reduce((a, m) => a + m.totalBal, 0);
  const totalUsd = porMes.reduce((a, m) => a + m.resultadoUsd, 0);
  const tasaAnual = totalOps > 0 ? (totalGan / totalOps) * 100 : 0;
  const rrPromedio = porMes.reduce((a, m) => a + m.rr, 0) / porMes.length;

  // Acumulado mes a mes con reduce, sin reasignar durante el render.
  const equidad = porMes.reduce<{ nombre: string; acumulado: number }[]>((acc, m) => {
    const previo = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
    acc.push({ nombre: m.nombre, acumulado: Number((previo + m.totalBal).toFixed(2)) });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Operaciones totales"
          value={totalOps.toLocaleString("es")}
          sub={`${porMes.length} ${porMes.length === 1 ? "mes activo" : "meses activos"}`}
        />
        <Kpi
          label="Tasa de éxito anual"
          value={fmtTasa(tasaAnual)}
          sub={`${totalGan} ganadoras`}
          valueColor={colorTasa(tasaAnual)}
        />
        <Kpi
          label="Balance de puntos"
          value={fmtPuntos(totalBal)}
          sub={fmtUsd(totalUsd)}
          valueColor={colorSigno(totalBal)}
        />
        <Kpi
          label="Ratio R/B promedio"
          value={fmtRatio(rrPromedio)}
          valueColor={colorRatio(rrPromedio)}
        />
      </div>

      <Card>
        <SectionLabel>Balance de puntos por mes</SectionLabel>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porMes}>
            <CartesianGrid stroke={ejes.grid} vertical={false} />
            <XAxis dataKey="nombre" stroke={ejes.axis} fontSize={11} />
            <YAxis stroke={ejes.axis} fontSize={11} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={fmtTooltip((v) => `${v.toFixed(2)} pts`, "Balance")}
            />
            <ReferenceLine y={0} stroke={ejes.grid} />
            <Bar dataKey="totalBal" name="Balance" radius={[4, 4, 0, 0]}>
              {porMes.map((m) => (
                <Cell key={m.mes} fill={colorSigno(m.totalBal)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionLabel>Curva de equidad acumulada</SectionLabel>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={equidad}>
              <CartesianGrid stroke={ejes.grid} vertical={false} />
              <XAxis dataKey="nombre" stroke={ejes.axis} fontSize={11} />
              <YAxis stroke={ejes.axis} fontSize={11} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={fmtTooltip((v) => `${v.toFixed(2)} pts`, "Acumulado")}
              />
              <ReferenceLine y={0} stroke={ejes.grid} />
              <Area
                type="monotone"
                dataKey="acumulado"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="var(--series-1)"
                fillOpacity={0.12}
                dot={{ r: 4 }}
                name="Acumulado"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionLabel>Tasa de éxito por mes (%)</SectionLabel>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porMes}>
              <CartesianGrid stroke={ejes.grid} vertical={false} />
              <XAxis dataKey="nombre" stroke={ejes.axis} fontSize={11} />
              <YAxis stroke={ejes.axis} fontSize={11} domain={[0, 110]} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={fmtTooltip((v) => `${v.toFixed(1)}%`, "Tasa")}
              />
              <ReferenceLine
                y={50}
                stroke="var(--status-good)"
                strokeDasharray="3 3"
                label={{
                  value: "50% meta",
                  fill: "var(--text-muted)",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Bar dataKey="tasa" name="Tasa" radius={[4, 4, 0, 0]}>
                {porMes.map((m) => (
                  <Cell key={m.mes} fill={colorTasa(m.tasa)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionLabel>Tasa de éxito vs ratio R/B</SectionLabel>
        <p className="mb-2 text-xs text-[var(--text-secondary)]">
          Zona ideal: tasa por encima de 50 % y R/B por encima de 1,5. El color indica si el
          balance del mes fue a favor o en contra.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid stroke={ejes.grid} />
            <XAxis
              type="number"
              dataKey="tasa"
              name="Tasa"
              unit="%"
              stroke={ejes.axis}
              fontSize={11}
              domain={[0, 100]}
              label={{
                value: "Tasa de éxito (%)",
                position: "insideBottom",
                offset: -10,
                fill: "var(--text-muted)",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="rr"
              name="R/B"
              stroke={ejes.axis}
              fontSize={11}
              label={{
                value: "Ratio R/B",
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)",
                fontSize: 11,
              }}
            />
            <ZAxis range={[140, 140]} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(v, n) => [
                n === "Tasa" ? `${Number(v).toFixed(1)}%` : Number(v).toFixed(2),
                String(n),
              ]}
              labelFormatter={() => ""}
            />
            <ReferenceLine x={50} stroke="var(--status-good)" strokeDasharray="3 3" />
            <ReferenceLine y={1.5} stroke="var(--series-7)" strokeDasharray="3 3" />
            <Scatter data={porMes} name="Meses">
              {porMes.map((m) => (
                <Cell key={m.mes} fill={colorSigno(m.totalBal)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        {/* Identidad de cada punto sin depender del color: el scatter no lleva
            leyenda porque los meses ya están nombrados en la tabla de abajo. */}
      </Card>

      <Card>
        <SectionLabel>Comparativa mensual</SectionLabel>
        <Tabla>
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
              <Th>Mes</Th>
              <Th>Ops</Th>
              <Th>Gan.</Th>
              <Th>Perd.</Th>
              <Th>Tasa</Th>
              <Th>Balance pts</Th>
              <Th>R/B</Th>
              <Th>Resultado USD</Th>
            </tr>
          </thead>
          <tbody>
            {porMes.map((m) => (
              <tr key={m.mes} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5">{m.nombre}</td>
                <Td>{m.totalOps}</Td>
                <Td>{m.totalGan}</Td>
                <Td>{m.totalPer}</Td>
                <Td>
                  <span style={{ color: colorTasa(m.tasa) }}>{fmtTasa(m.tasa)}</span>
                </Td>
                <Td>
                  <span style={{ color: colorSigno(m.totalBal) }}>{fmtPuntos(m.totalBal)}</span>
                </Td>
                <Td>{fmtRatio(m.rr)}</Td>
                <Td>
                  <span style={{ color: colorSigno(m.resultadoUsd) }}>
                    {fmtUsd(m.resultadoUsd)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Card>
    </div>
  );
}
