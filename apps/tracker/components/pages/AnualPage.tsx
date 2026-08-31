"use client";

import { MESES, getStatsMes, type ConfigMes, type StatsMes } from "@/lib/trading/calc";
import { CONFIG_POR_DEFECTO, type MapaDias } from "@/lib/trading/data";
import {
  CHART_COLOR,
  Card,
  ComboChart,
  KpiStrip,
  LineChart,
  QuadrantChart,
  Tabla,
  Td,
  Th,
  VarianceChart,
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
        <p className="text-[length:var(--text-md)] text-[var(--text-secondary)]">
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
  const equidad = porMes.reduce<number[]>((acc, m) => {
    const previo = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(Number((previo + m.totalBal).toFixed(2)));
    return acc;
  }, []);

  const nombres = porMes.map((m) => m.nombre);

  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          {
            label: "Operaciones",
            value: totalOps.toLocaleString("es"),
            sub: `${porMes.length} ${porMes.length === 1 ? "mes activo" : "meses activos"}`,
            spark: porMes.map((m) => m.totalOps),
          },
          {
            label: "Tasa de éxito anual",
            value: fmtTasa(tasaAnual),
            sub: `${totalGan} ganadoras`,
            valueColor: colorTasa(tasaAnual),
            spark: porMes.map((m) => m.tasa),
          },
          {
            label: "Balance de puntos",
            value: fmtPuntos(totalBal),
            sub: fmtUsd(totalUsd),
            valueColor: colorSigno(totalBal),
            spark: equidad,
          },
          {
            label: "Ratio R/B promedio",
            value: fmtRatio(rrPromedio),
            sub: "Promedio de los meses activos",
            valueColor: colorRatio(rrPromedio),
            spark: porMes.map((m) => m.rr),
          },
        ]}
      />

      <WidgetGrid>
        <Widget
          title="Balance de puntos por mes"
          meta="Saldo neto del mes, no acumulado"
          note="Cada barra es el mes por separado. Para ver si el año va sumando, la lectura es la curva de equidad."
        >
          <VarianceChart
            values={porMes.map((m) => m.totalBal)}
            labels={nombres}
            fmt={(v) => v.toFixed(0)}
          />
        </Widget>

        <Widget
          title="Curva de equidad acumulada"
          meta="Puntos, mes a mes"
          span={6}
          note="Suma corrida de los saldos mensuales. Es lo que dice si el año avanza o devuelve."
        >
          <LineChart
            area
            labels={nombres}
            series={[{ name: "Acumulado", color: CHART_COLOR.accent, values: equidad }]}
            fmt={(v) => fmtPuntos(v, 0)}
            every={1}
          />
        </Widget>

        <Widget
          title="Tasa de éxito por mes"
          meta="%"
          span={6}
          note="Verde por encima del 50 %, ámbar entre 40 y 50, rojo por debajo."
        >
          <ComboChart
            data={porMes.map((m) => ({ label: m.nombre, values: [m.tasa] }))}
            keys={["Tasa"]}
            colors={[CHART_COLOR.accent]}
            barColorFn={(i) => colorTasa(porMes[i].tasa)}
            axisMax={100}
            fmt={(v) => `${v.toFixed(0)}%`}
            refLines={[{ value: 50, label: "50 % objetivo", color: "var(--status-good)" }]}
          />
        </Widget>

        <Widget
          title="Tasa de éxito vs ratio R/B"
          meta="Un punto por mes"
          note={
            <>
              La zona ideal es arriba a la derecha: acierto por encima del 50 %{" "}
              <em>y</em> R/B por encima de 1,5. El color dice si el balance del mes fue a favor o
              en contra — un mes puede caer en zona buena y aun así perder puntos, y eso es
              justo lo que hay que ver.
            </>
          }
        >
          <QuadrantChart
            points={porMes.map((m) => ({
              label: m.nombre.slice(0, 3),
              x: m.tasa,
              y: m.rr,
              color: colorSigno(m.totalBal),
            }))}
            xLabel="Tasa de éxito (%)"
            yLabel="Ratio R/B"
            xFmt={(v) => `${v.toFixed(0)}%`}
            yFmt={(v) => v.toFixed(1)}
            xDomain={[0, 100]}
            xDivider={50}
            yDivider={1.5}
            quadrantLabels={{
              q1: "acierto y ratio en objetivo",
              q2: "buen ratio, poco acierto",
              q3: "los dos por debajo",
              q4: "mucho acierto, ratio corto",
            }}
          />
        </Widget>

        <Widget title="Comparativa mensual">
          <Tabla>
            <thead>
              <tr>
                <Th num={false}>Mes</Th>
                <Th num>Ops</Th>
                <Th num>Gan.</Th>
                <Th num>Perd.</Th>
                <Th num>Tasa</Th>
                <Th num>Balance pts</Th>
                <Th num>R/B</Th>
                <Th num>Resultado USD</Th>
              </tr>
            </thead>
            <tbody>
              {porMes.map((m) => (
                <tr key={m.mes}>
                  <Td num={false}>{m.nombre}</Td>
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
        </Widget>
      </WidgetGrid>
    </div>
  );
}
