"use client";

import type { HistoricalYear } from "@/lib/finance/historical";
import {
  CHART_COLOR,
  Card,
  ChartLegend,
  ComboChart,
  Tabla,
  Td,
  Th,
  Widget,
  WidgetGrid,
  fmtBillions,
} from "../ui";

export function FinancialsTab({ hist }: { hist: HistoricalYear[] }) {
  if (hist.length === 0) {
    return (
      <Card>
        <p className="text-[length:var(--text-md)] text-[var(--text-secondary)]">
          No historical financial data available.
        </p>
      </Card>
    );
  }

  // Los nulos van a 0 en el gráfico: una barra ausente y una barra en cero se
  // distinguen mal, y la tabla de abajo ya muestra el "—" cuando el dato no
  // existe. El gráfico da la forma; la tabla, el dato exacto.
  const revData = hist.map((h) => ({
    label: String(h.year),
    values: [(h.revenue ?? 0) / 1e9, (h.netIncome ?? 0) / 1e9],
  }));

  const fcfData = hist.map((h) => ({
    label: String(h.year),
    values: [(h.opCf ?? 0) / 1e9],
    line: (h.fcf ?? 0) / 1e9,
  }));

  const enMiles = (v: number) => `${v.toFixed(1)}B`;

  return (
    <div className="space-y-4">
      <WidgetGrid>
        <Widget title="Revenue & Net Income" meta="Miles de millones de USD" span={6}>
          <ComboChart
            data={revData}
            keys={["Revenue", "Net Income"]}
            colors={[CHART_COLOR.accent, CHART_COLOR.win]}
            fmt={enMiles}
            height={260}
          />
          <ChartLegend
            items={[
              { label: "Revenue", color: CHART_COLOR.accent },
              { label: "Net Income", color: CHART_COLOR.win },
            ]}
          />
        </Widget>

        <Widget
          title="Free Cash Flow vs Operating Cash Flow"
          meta="Miles de millones de USD"
          span={6}
          note="La barra es el flujo de operación y la línea el flujo libre. La diferencia entre las dos es lo que se va en inversión de capital."
        >
          <ComboChart
            data={fcfData}
            keys={["Operating CF"]}
            colors={[CHART_COLOR.accent]}
            lineColor={CHART_COLOR.win}
            lineLabel="FCF"
            lineFmt={enMiles}
            fmt={enMiles}
            height={260}
          />
          <ChartLegend
            items={[
              { label: "Operating CF", color: CHART_COLOR.accent },
              { label: "FCF", color: CHART_COLOR.win },
            ]}
          />
        </Widget>

        <Widget title="Year-over-Year Growth" meta="%" span={6}>
          <Tabla>
            <thead>
              <tr>
                <Th num={false}>Year</Th>
                <Th num>Revenue</Th>
                <Th num>Op Income</Th>
                <Th num>Net Income</Th>
                <Th num>FCF</Th>
              </tr>
            </thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.year}>
                  <Td num={false}>{h.year}</Td>
                  <Td>{fmtYoY(h.revenueYoY)}</Td>
                  <Td>{fmtYoY(h.opIncomeYoY)}</Td>
                  <Td>{fmtYoY(h.netIncomeYoY)}</Td>
                  <Td>{fmtYoY(h.fcfYoY)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Widget>

        <Widget title="Balance Sheet Summary" meta="Miles de millones de USD" span={6}>
          <Tabla>
            <thead>
              <tr>
                <Th num={false}>Year</Th>
                <Th num>Debt</Th>
                <Th num>Cash</Th>
                <Th num>Equity</Th>
              </tr>
            </thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.year}>
                  <Td num={false}>{h.year}</Td>
                  <Td>{fmtBillions(h.debt)}</Td>
                  <Td>{fmtBillions(h.cash)}</Td>
                  <Td>{fmtBillions(h.equity)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Widget>
      </WidgetGrid>
    </div>
  );
}

function fmtYoY(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
