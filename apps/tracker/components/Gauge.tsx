"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

/**
 * Gauge semicircular para una métrica con objetivo conocido.
 *
 * Recharts no trae un gauge; se arma con RadialBarChart de media vuelta, igual
 * que en el Screener. El valor va escrito debajo: el arco solo da el contexto
 * visual, el número es lo que se lee.
 */
export function Gauge({
  label,
  valor,
  max,
  color,
  formato,
}: {
  label: string;
  valor: number;
  max: number;
  color: string;
  formato: (v: number) => string;
}) {
  const acotado = Math.max(0, Math.min(max, valor));

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <RadialBarChart
        width={190}
        height={120}
        cx={95}
        cy={104}
        innerRadius={66}
        outerRadius={90}
        startAngle={180}
        endAngle={0}
        barSize={14}
        data={[{ value: acotado, fill: color }]}
      >
        <PolarAngleAxis type="number" domain={[0, max]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: "var(--surface-2)" }} dataKey="value" cornerRadius={7} />
      </RadialBarChart>
      <div className="-mt-12 font-mono text-xl font-bold" style={{ color }}>
        {formato(valor)}
      </div>
    </div>
  );
}
