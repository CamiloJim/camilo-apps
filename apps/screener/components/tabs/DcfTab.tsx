"use client";

import { useMemo, useState } from "react";
import type { HistoricalYear } from "@/lib/finance/historical";
import { intrinsicPrice, projectFcf, terminalValue } from "@/lib/finance/dcf";
import {
  CHART_COLOR,
  Card,
  ChartLegend,
  ComboChart,
  DonutChart,
  KpiStrip,
  Tabla,
  Td,
  Th,
  Widget,
  WidgetGrid,
  fmtBillions,
  fmtUsd,
} from "../ui";
import { MarginGauge } from "../Gauge";

export function DcfTab({
  hist,
  wacc,
  riskFree,
  price,
  shares,
  manualGrowth,
  manualWacc,
}: {
  hist: HistoricalYear[];
  wacc: number;
  riskFree: { rate: number; source: string };
  price: number | null;
  shares: number | null;
  manualGrowth: number | null;
  manualWacc: number | null;
}) {
  const fcfSeries = hist.filter((h) => h.fcf !== null).slice(-3);
  const baseFcf =
    fcfSeries.length >= 2
      ? fcfSeries.reduce((s, h) => s + (h.fcf ?? 0), 0) / fcfSeries.length
      : null;

  const histGrowth = useMemo(() => {
    const yoys = hist.map((h) => h.fcfYoY).filter((v): v is number => v !== null);
    if (yoys.length === 0) return 8;
    const avg = yoys.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, yoys.length);
    return Math.min(Math.max(avg, -30), 40);
  }, [hist]);

  const [growthPct, setGrowthPct] = useState(Math.round(histGrowth * 10) / 10);
  const [waccPct, setWaccPct] = useState(Math.round(wacc * 1000) / 10);
  const [perpGrowthPct, setPerpGrowthPct] = useState(2.5);

  if (baseFcf === null || baseFcf <= 0) {
    return (
      <Card>
        <p className="text-[length:var(--text-md)] text-[var(--text-secondary)]">
          Insufficient or negative FCF history — DCF not available.
        </p>
      </Card>
    );
  }

  const growthUsed = (manualGrowth ?? growthPct) / 100;
  const waccUsed = (manualWacc ?? waccPct) / 100;
  const perpGrowth = perpGrowthPct / 100;

  const lastRow = hist[hist.length - 1];
  const netCash = (lastRow?.cash ?? 0) - (lastRow?.debt ?? 0);
  const sharesN = shares ?? 1;

  const fcfs5 = projectFcf(baseFcf, growthUsed, 5);
  const fcfs10 = projectFcf(baseFcf, growthUsed, 10);
  const tv5 = terminalValue(fcfs5[fcfs5.length - 1], waccUsed, perpGrowth);
  const tv10 = terminalValue(fcfs10[fcfs10.length - 1], waccUsed, perpGrowth);
  const price5 = intrinsicPrice(fcfs5, tv5, waccUsed, netCash, sharesN);
  const price10 = intrinsicPrice(fcfs10, tv10, waccUsed, netCash, sharesN);
  const margin5 = price ? ((price5 - price) / price) * 100 : 0;
  const margin10 = price ? ((price10 - price) / price) * 100 : 0;

  const pvs = fcfs10.map((f, i) => f / Math.pow(1 + waccUsed, i + 1));
  // El FCF proyectado va como barra y su valor presente como línea, sobre el
  // mismo eje (ver ComboChart): las dos son dinero, y la lectura es justo la
  // distancia entre ambas — cuánto se come el descuento según se aleja el año.
  const projData = fcfs10.map((f, i) => ({
    label: `Y${i + 1}`,
    values: [f / 1e9] as const,
    pv: pvs[i] / 1e9,
  }));

  const pvFcfs10 = pvs.reduce((a, b) => a + b, 0);
  const pvTv10 = tv10 / Math.pow(1 + waccUsed, 10);
  const pieData = [
    { label: "PV of FCFs", value: Math.max(pvFcfs10, 0), color: CHART_COLOR.accent },
    { label: "PV of Terminal Value", value: Math.max(pvTv10, 0), color: CHART_COLOR.secondary },
    { label: "Net Cash", value: Math.max(netCash, 0), color: CHART_COLOR.win },
  ];
  const valorTotal = pieData.reduce((a, d) => a + d.value, 0);

  return (
    <div className="space-y-4">
      <Widget
        title="DCF Parameters"
        meta={`Risk-free rate: ${(riskFree.rate * 100).toFixed(2)}% (${riskFree.source})`}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <SliderField
            label="FCF Growth Rate (%)"
            value={growthPct}
            min={-20}
            max={40}
            step={0.5}
            disabled={manualGrowth !== null}
            onChange={setGrowthPct}
          />
          <SliderField
            label="WACC (%)"
            value={waccPct}
            min={3}
            max={20}
            step={0.25}
            disabled={manualWacc !== null}
            onChange={setWaccPct}
          />
          <SliderField
            label="Perpetual Growth (%)"
            value={perpGrowthPct}
            min={1}
            max={4}
            step={0.1}
            onChange={setPerpGrowthPct}
          />
        </div>
      </Widget>

      <KpiStrip
        items={[
          { label: "Current Price", value: fmtUsd(price) },
          {
            label: "Intrinsic Value (5yr)",
            value: fmtUsd(price5),
            sub: `${margin5 >= 0 ? "+" : ""}${margin5.toFixed(1)}% vs. precio`,
          },
          {
            label: "Intrinsic Value (10yr)",
            value: fmtUsd(price10),
            sub: `${margin10 >= 0 ? "+" : ""}${margin10.toFixed(1)}% vs. precio`,
          },
        ]}
      />

      <WidgetGrid>
        <Widget
          title="Projected FCF — 10 Years"
          meta="Miles de millones de USD"
          note="La barra es el flujo proyectado y la línea su valor presente. La distancia entre las dos ES el descuento: cuanto más lejos el año, menos vale hoy."
        >
          <ComboChart
            data={projData.map((d) => ({ label: d.label, values: d.values, line: d.pv }))}
            keys={["Projected FCF"]}
            colors={[CHART_COLOR.accent]}
            lineColor={CHART_COLOR.win}
            lineLabel="PV (discounted)"
            lineFmt={(v) => `${v.toFixed(1)}B`}
            fmt={(v) => `${v.toFixed(1)}B`}
            height={280}
          />
          <ChartLegend
            items={[
              { label: "Projected FCF", color: CHART_COLOR.accent },
              { label: "PV (discounted)", color: CHART_COLOR.win },
            ]}
          />
        </Widget>

        <Widget
          title="Margin of Safety"
          meta="El centro del arco es el precio justo"
          span={6}
        >
          <div className="flex flex-wrap justify-around gap-6">
            <MarginGauge label="5-Year Horizon" margin={margin5} />
            <MarginGauge label="10-Year Horizon" margin={margin10} />
          </div>
        </Widget>

        <Widget
          title="Value Composition (10yr)"
          meta={fmtBillions(valorTotal)}
          span={6}
          note="Si el valor terminal pesa más que los flujos, la valoración depende sobre todo de un supuesto a diez años vista."
        >
          <DonutChart
            data={pieData}
            centerLabel={fmtBillions(valorTotal)}
            centerSub="valor total"
            fmt={(v) => fmtBillions(v)}
            size={180}
          />
        </Widget>

        <Widget title="Year-by-Year DCF Table">
          <Tabla>
            <thead>
              <tr>
                <Th num={false}>Year</Th>
                <Th num>Projected FCF</Th>
                <Th num>PV (discounted)</Th>
                <Th num>Cumulative PV</Th>
              </tr>
            </thead>
            <tbody>
              {fcfs10.map((f, i) => (
                <tr key={i}>
                  <Td num={false}>Y{i + 1}</Td>
                  <Td>{fmtBillions(f)}</Td>
                  <Td>{fmtBillions(pvs[i])}</Td>
                  <Td>{fmtBillions(pvs.slice(0, i + 1).reduce((a, b) => a + b, 0))}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Widget>
      </WidgetGrid>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[length:var(--text-md)] text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-[var(--text-primary)]">
          {value.toFixed(2)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--gold)] disabled:opacity-40"
      />
    </div>
  );
}
