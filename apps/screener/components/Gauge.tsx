"use client";

import { Gauge } from "@camilo-apps/ui";
import { marginColor, Verdict } from "./ui";

/**
 * Medidor semicircular del margen de seguridad, de −100 % a +100 %.
 *
 * El arco genérico va de 0 a `max`, así que el margen se desplaza sumándole 100
 * y el eje pasa a ser 0–200: el centro del arco es el 0 % de margen, o sea el
 * precio justo. El número que se lee debajo sí es el margen real, con signo.
 */
export function MarginGauge({ label, margin }: { label: string; margin: number }) {
  const color = marginColor(margin);
  return (
    <div className="grid justify-items-center gap-1">
      <Gauge
        label={label}
        valor={Math.max(-100, Math.min(100, margin)) + 100}
        max={200}
        color={color}
        formato={() => `${margin >= 0 ? "+" : ""}${margin.toFixed(1)}%`}
      />
      <Verdict margin={margin} />
    </div>
  );
}
