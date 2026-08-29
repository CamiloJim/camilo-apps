"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { marginColor, Verdict } from "./ui";

/** Gauge semicircular de -100% a +100%, usado para el margen de seguridad. */
export function MarginGauge({ label, margin }: { label: string; margin: number }) {
  const clamped = Math.max(-100, Math.min(100, margin));
  const color = marginColor(margin);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <RadialBarChart
        width={200}
        height={130}
        cx={100}
        cy={110}
        innerRadius={70}
        outerRadius={95}
        startAngle={180}
        endAngle={0}
        barSize={14}
        data={[{ value: clamped + 100, fill: color }]}
      >
        <PolarAngleAxis type="number" domain={[0, 200]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: "var(--surface-2)" }} dataKey="value" cornerRadius={7} />
      </RadialBarChart>
      <div className="-mt-14 font-mono text-xl font-bold" style={{ color }}>
        {margin >= 0 ? "+" : ""}
        {margin.toFixed(1)}%
      </div>
      <div className="mt-1">
        <Verdict margin={margin} />
      </div>
    </div>
  );
}
