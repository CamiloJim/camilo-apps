"use client";

/*
 * Primitivas de gráfico compartidas — Screener y Trading Tracker.
 *
 * Portadas de marketing-app (`apps/web/features/paid-media/charts/svg-chart.tsx`),
 * que a su vez venían del Ads Analyst. El objetivo del port es que TODOS los
 * gráficos de las dos apps compartan una sola gramática de eje, rejilla,
 * etiqueta, leyenda y tooltip, en vez de que cada uno invente la suya.
 *
 * ── Qué cambió respecto al original ─────────────────────────────────────────
 * 1. Los colores resuelven contra los tokens de Camilo (ver tokens.css, donde
 *    los nombres --color-* están aliasados). Ni un hex aquí dentro.
 * 2. Se portó solo lo que tiene consumidor real. Quedaron fuera el mapa
 *    coropleta, el embudo, el diagrama de caja, las barras apiladas
 *    horizontales y el de doble eje: ninguna de las dos apps los usa, y código
 *    sin consumidor es código que nadie verifica.
 * 3. Se añadió `refLines` a LineChart y ComboChart. El original no tenía
 *    líneas de referencia porque no las necesitaba; aquí son la mitad de la
 *    lectura (el 50 % de tasa objetivo, el 1,5 de R/B).
 * 4. Se añadió DivergingStackedChart, que no existe en el original.
 *
 * ── Por qué SVG a mano y no una librería ────────────────────────────────────
 * Sustituye a Recharts. Pesa 0 KB de dependencia, los tooltips son <title>
 * nativos (accesibles y sin nodos extra), y el tamaño de fuente no se deforma
 * al estirar el gráfico, que es el defecto que hacía que los ejes se vieran
 * aplastados en las tarjetas estrechas.
 */

import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";

/** Ancho de coordenadas antes de que el gráfico se haya medido (SSR, primer pintado). */
const VIEW_WIDTH = 640;

/**
 * Devuelve el tamaño renderizado real como tamaño de coordenadas del SVG, de
 * forma que 1 unidad === 1 px de CSS. Sin esto, un viewBox fijo estirado a un
 * contenedor más estrecho deforma las etiquetas horizontalmente.
 *
 * El alto solo se mide con `fillHeight`; en el resto viene de la prop y el CSS
 * lo deja en `auto`, porque medirlo realimentaría el propio alto del SVG en el
 * viewBox y entraría en bucle. Si no hay ResizeObserver (servidor, tests) cae
 * al tamaño dado, así que el gráfico igual dibuja su contenido.
 */
function useMeasuredSize(
  fallbackHeight: number,
  fillHeight = false
): readonly [RefObject<SVGSVGElement | null>, number, number] {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: VIEW_WIDTH, height: fallbackHeight });
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize((prev) => {
        const width = rect.width > 0 ? rect.width : prev.width;
        const height = fillHeight && rect.height > 0 ? rect.height : prev.height;
        return width === prev.width && height === prev.height ? prev : { width, height };
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fillHeight]);
  return [ref, size.width, size.height];
}

function useMeasuredWidth(): readonly [RefObject<SVGSVGElement | null>, number] {
  const [ref, width] = useMeasuredSize(0);
  return [ref, width];
}

/**
 * Paleta de gráfico. La serie 1 es el oro de la marca; el resto sale de la
 * categórica de tokens.css, que es de orden fijo y no se cicla.
 */
export const CHART_COLOR = {
  accent: "var(--series-1)",
  comparison: "var(--series-7)",
  secondary: "var(--series-2)",
  muted: "var(--text-muted)",
  positive: "var(--status-good)",
  negative: "var(--status-critical)",
  win: "var(--series-3)",
  loss: "var(--series-8)",
} as const;

/**
 * El texto SVG no llega a la escala --text-* (aquí font-size es un número de px
 * sin unidad, no rem), así que tiene su propia escala corta y consistente.
 */
const CHART_FONT = {
  /** Marcas de eje y pies de dato. */
  tick: 10.5,
  /** Etiquetas legibles de valor o categoría. */
  label: 12.5,
  /** Una única cifra protagonista (el centro del donut). */
  hero: 17,
} as const;

const SVG_STYLE: CSSProperties = {
  display: "block",
  height: "auto",
  overflow: "visible",
  width: "100%",
};

/* ── Formato ──────────────────────────────────────────────────────────────
 * Local y mínimo: las apps ya traen sus propios formateadores de dominio
 * (fmtUsd, fmtPuntos, fmtTasa…) y se los pasan al gráfico por `fmt`. Esto es
 * solo el valor por defecto de un eje sin formateador.
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Redondea el techo del eje a un número "bonito" (1, 2, 2.5, 5, 10 × 10^n)
 * para que las marcas caigan en cifras legibles y no en 3.847.
 */
function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exponent;
  const multiple =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return multiple * exponent;
}

interface ChartFrame {
  padL: number;
  padT: number;
  iw: number;
  ih: number;
  max: number;
  min: number;
  ticks: readonly { y: number; value: number }[];
  y: (value: number) => number;
  xPoint: (index: number, count: number) => number;
}

function buildFrame(o: {
  width: number;
  height: number;
  max: number;
  min?: number;
  ticks?: number;
  padL?: number;
  padR?: number;
  padB?: number;
  /** Techo exacto del eje. Sin él se redondea al "bonito" más cercano. */
  axisMax?: number;
}): ChartFrame {
  const padL = o.padL ?? 46,
    padR = o.padR ?? 12,
    padT = 10,
    padB = o.padB ?? 22;
  const iw = o.width - padL - padR,
    ih = o.height - padT - padB;
  const min = o.min ?? 0;
  const max = o.axisMax ?? (min < 0 ? o.max : niceMax(o.max));
  const tickCount = o.ticks ?? 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = min + (max - min) * (index / tickCount);
    return { value, y: padT + ih - (ih * index) / tickCount };
  });
  return {
    padL,
    padT,
    iw,
    ih,
    max,
    min,
    ticks,
    y: (value) => padT + ih - (ih * (value - min)) / (max - min || 1),
    xPoint: (index, count) => (count <= 1 ? padL + iw / 2 : padL + (iw * index) / (count - 1)),
  };
}

function Axis({ frame, fmt }: { frame: ChartFrame; fmt: (value: number) => string }) {
  return (
    <g>
      {frame.ticks.map((tick, index) => (
        <g key={tick.value}>
          <line
            stroke="var(--color-border)"
            strokeOpacity={index === 0 ? 1 : 0.5}
            strokeWidth={1}
            x1={frame.padL}
            x2={frame.padL + frame.iw}
            y1={tick.y}
            y2={tick.y}
          />
          <text
            fill="var(--color-text-muted)"
            fontSize={CHART_FONT.tick}
            textAnchor="end"
            x={frame.padL - 8}
            y={tick.y + 3}
          >
            {fmt(tick.value)}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({
  frame,
  labels,
  every,
}: {
  frame: ChartFrame;
  labels: readonly string[];
  every?: number;
}) {
  const count = labels.length;
  const step = every ?? Math.max(1, Math.ceil(count / 7));
  return (
    <g>
      {labels.map((label, index) => {
        if (index % step !== 0 && index !== count - 1) return null;
        const anchor = index === 0 ? "start" : index === count - 1 ? "end" : "middle";
        return (
          <text
            fill="var(--color-text-muted)"
            fontSize={CHART_FONT.tick}
            key={`${label}-${index}`}
            textAnchor={anchor}
            x={frame.padL + (frame.iw * index) / (count - 1 || 1)}
            y={frame.padT + frame.ih + 14}
          >
            {label}
          </text>
        );
      })}
    </g>
  );
}

/**
 * Línea de referencia horizontal: el umbral contra el que se lee la serie.
 *
 * No existe en el original de marketing-app. Aquí es media lectura: una tasa
 * de acierto sin el 50 % dibujado es un número sin veredicto.
 */
export interface RefLine {
  value: number;
  label?: string;
  color?: string;
}

/** Separación mínima entre dos etiquetas de referencia antes de que se pisen. */
const REF_LABEL_GAP = 13;

interface RefLineLayout {
  line: RefLine;
  y: number;
  /** Dónde cabe el rótulo, o null si no cabe en ningún lado. */
  labelY: number | null;
}

/**
 * Coloca las líneas de referencia y decide dónde cabe cada rótulo.
 *
 * Se recorren de arriba abajo llevando la cuenta de dónde acabó el anterior.
 * Umbrales cercanos —el 50 % y el 40 % de la tasa, o el 1,5 y el 1 del R/B—
 * caen a pocos píxeles y sin esto se imprimen encima, que es justo lo que
 * pasaba: dos textos superpuestos e ilegibles en la esquina.
 *
 * El rótulo que no cabe encima de su línea se manda debajo. Si tampoco cabe
 * ahí, se omite: mejor una línea sin rótulo que dos textos pisados.
 */
function layoutRefLines(frame: ChartFrame, lines: readonly RefLine[]): RefLineLayout[] {
  let ultima = -Infinity;
  return [...lines]
    .map((line) => ({ line, y: frame.y(line.value) }))
    .filter(({ y }) => y >= frame.padT && y <= frame.padT + frame.ih)
    .sort((a, b) => a.y - b.y)
    .map(({ line, y }) => {
      let labelY: number | null = null;
      if (line.label) {
        const encima = y - 4;
        const debajo = y + 11;
        if (encima - ultima >= REF_LABEL_GAP) labelY = encima;
        else if (debajo - ultima >= REF_LABEL_GAP) labelY = debajo;
        if (labelY !== null) ultima = labelY;
      }
      return { line, y, labelY };
    });
}

/**
 * Las líneas van DETRÁS de los datos y los rótulos DELANTE, por eso son dos
 * componentes y no uno: una línea de umbral pintada sobre las barras compite
 * con el dato, pero un rótulo pintado debajo desaparece bajo la primera barra
 * que le toque —que es lo que ocurría con el 29/04, la barra más alta del mes—.
 */
function RefLineMarks({
  frame,
  layout,
}: {
  frame: ChartFrame;
  layout: readonly RefLineLayout[];
}) {
  return (
    <g>
      {layout.map(({ line, y }) => (
        <line
          key={`${line.value}-l`}
          stroke={line.color ?? CHART_COLOR.muted}
          strokeDasharray="3 4"
          strokeOpacity={0.85}
          strokeWidth={1}
          x1={frame.padL}
          x2={frame.padL + frame.iw}
          y1={y}
          y2={y}
        />
      ))}
    </g>
  );
}

function RefLineLabels({
  frame,
  layout,
}: {
  frame: ChartFrame;
  layout: readonly RefLineLayout[];
}) {
  return (
    <g>
      {layout.map(({ line, labelY }) =>
        labelY === null ? null : (
          <text
            key={`${line.value}-t`}
            fill={line.color ?? CHART_COLOR.muted}
            fontSize={CHART_FONT.tick}
            /* El trazo del color del fondo por debajo del relleno recorta un
               halo alrededor de la letra, para que se lea también cuando cae
               justo sobre una barra. */
            paintOrder="stroke"
            stroke="var(--color-surface)"
            strokeWidth={3}
            strokeLinejoin="round"
            textAnchor="end"
            x={frame.padL + frame.iw}
            y={labelY}
          >
            {line.label}
          </text>
        )
      )}
    </g>
  );
}

export interface ChartSeries {
  name: string;
  color: string;
  values: readonly number[];
  dashed?: boolean;
}

/**
 * Serie temporal multi-línea con ejes reales, tooltip por punto y series
 * comparativas punteadas.
 *
 * Con `area`, cada serie se rellena con un degradado vertical que se desvanece
 * hacia la base, más una sombra suave en el trazo. Con varias series
 * solapadas, esa sombra es lo que mantiene las curvas legibles donde los
 * rellenos translúcidos se apilan, así que van siempre juntas. Los rellenos se
 * pintan todos primero y los trazos después, para que ningún relleno entierre
 * una línea que pasa por debajo.
 */
export function LineChart({
  series,
  labels,
  height = 220,
  fmt = formatCompact,
  every,
  area = false,
  refLines,
  min,
}: {
  series: readonly ChartSeries[];
  labels: readonly string[];
  height?: number;
  fmt?: (value: number) => string;
  every?: number;
  area?: boolean;
  refLines?: readonly RefLine[];
  /** Fija el suelo del eje. Útil cuando la serie puede ser negativa. */
  min?: number;
}) {
  const [ref, width, measuredHeight] = useMeasuredSize(height);
  const gradientId = useId();
  const count = labels.length || series[0]?.values.length || 0;
  const all = series.flatMap((entry) => entry.values);
  const refValues = refLines?.map((r) => r.value) ?? [];
  const rawMax = Math.max(1, ...all, ...refValues);
  const rawMin = min ?? Math.min(0, ...all, ...refValues);
  const frame = buildFrame({
    width,
    height: measuredHeight,
    max: rawMax * 1.12,
    min: rawMin < 0 ? rawMin * 1.12 : 0,
  });
  const baseline = frame.y(Math.max(frame.min, 0));
  const refLayout = refLines ? layoutRefLines(frame, refLines) : [];
  const linePath = (entry: ChartSeries) =>
    entry.values
      .map(
        (value, index) =>
          `${index ? "L" : "M"}${frame.xPoint(index, count).toFixed(1)} ${frame.y(value).toFixed(1)}`
      )
      .join(" ");
  return (
    <svg
      aria-label="Serie temporal"
      ref={ref}
      role="img"
      style={SVG_STYLE}
      viewBox={`0 0 ${width} ${measuredHeight}`}
    >
      {area ? (
        <defs>
          {series.map((entry, index) => (
            <linearGradient
              id={`${gradientId}-${index}`}
              key={entry.name}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor={entry.color} stopOpacity={0.34} />
              <stop offset="100%" stopColor={entry.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
      ) : null}
      <Axis fmt={fmt} frame={frame} />
      {refLayout.length > 0 ? <RefLineMarks frame={frame} layout={refLayout} /> : null}
      {area
        ? series.map((entry, index) =>
            entry.values.length === 0 ? null : (
              <path
                d={`${linePath(entry)} L${frame.xPoint(entry.values.length - 1, count).toFixed(1)} ${baseline.toFixed(1)} L${frame.xPoint(0, count).toFixed(1)} ${baseline.toFixed(1)} Z`}
                fill={`url(#${gradientId}-${index})`}
                key={entry.name}
                stroke="none"
              />
            )
          )
        : null}
      {series.map((entry) => (
        <g key={entry.name}>
          <path
            d={linePath(entry)}
            fill="none"
            opacity={entry.dashed ? 0.75 : 1}
            stroke={entry.color}
            strokeDasharray={entry.dashed ? "4 4" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={entry.dashed ? 1.5 : 2}
            style={area ? { filter: "drop-shadow(0 3px 4px rgba(0, 0, 0, .5))" } : undefined}
          />
          {count <= 31
            ? entry.values.map((value, index) => (
                <circle
                  cx={frame.xPoint(index, count)}
                  cy={frame.y(value)}
                  fill={entry.color}
                  key={index}
                  r={entry.dashed ? 1.6 : 2.4}
                >
                  <title>{`${labels[index] ?? ""} · ${entry.name} · ${fmt(value)}`}</title>
                </circle>
              ))
            : null}
        </g>
      ))}
      {refLayout.length > 0 ? <RefLineLabels frame={frame} layout={refLayout} /> : null}
      <XLabels every={every} frame={frame} labels={labels} />
    </svg>
  );
}

export interface ComboDatum {
  label: string;
  values: readonly number[];
  /** Valor de la línea sobre el eje secundario. Omitido, no se dibuja línea. */
  line?: number;
}

/**
 * Barras agrupadas, opcionalmente con una línea superpuesta.
 *
 * Tres usos en estas apps:
 * - varias series por categoría (ganadoras/perdedoras por día), sin línea;
 * - una serie con color por barra vía `barColorFn` (tasa de acierto por día,
 *   donde el color ES el veredicto), también sin línea;
 * - barras + línea de la MISMA magnitud (flujo proyectado y su valor presente,
 *   flujo de operación y flujo libre).
 *
 * > La línea comparte el eje de las barras, a propósito. Antes tenía su propio
 * > eje auto-escalado, y con eso la distancia vertical entre barra y línea no
 * > significaba nada: cada una se estiraba a su rango. Los dos únicos usos que
 * > existen comparan importes en la misma unidad, y en los dos la lectura ES
 * > esa distancia (lo que se lleva el descuento, lo que se va en capex). Un eje
 * > secundario aquí no simplificaba: mentía. Si algún día hace falta cruzar dos
 * > magnitudes distintas, eso es otra primitiva, no una bandera en esta.
 */
export function ComboChart({
  data,
  keys,
  colors,
  height = 230,
  fmt = formatCompact,
  lineFmt = formatCompact,
  lineLabel,
  lineColor = CHART_COLOR.accent,
  barColorFn,
  barHeadroom = 1.18,
  refLines,
  axisMax,
}: {
  data: readonly ComboDatum[];
  keys: readonly string[];
  colors: readonly string[];
  height?: number;
  fmt?: (value: number) => string;
  lineFmt?: (value: number) => string;
  lineLabel?: string;
  lineColor?: string;
  /** Color por categoría en vez de por serie. Solo con una serie de barras. */
  barColorFn?: (entryIndex: number) => string;
  barHeadroom?: number;
  refLines?: readonly RefLine[];
  /**
   * Techo exacto del eje. Necesario para magnitudes con máximo natural: una
   * tasa de acierto no puede pasar del 100 %, y sin esto el redondeo "bonito"
   * de un 100 con holgura la llevaba a 200 y dejaba media tarjeta vacía.
   */
  axisMax?: number;
}) {
  const [ref, width] = useMeasuredWidth();
  const n = data.length || 1;
  const hasLine = data.some((entry) => entry.line != null);
  const refValues = refLines?.map((r) => r.value) ?? [];
  // La línea entra en el cálculo del techo porque comparte eje con las barras:
  // si un año el valor presente superara al flujo, se saldría del marco.
  const maxBars = Math.max(
    1,
    ...data.flatMap((entry) => entry.values),
    ...data.map((entry) => entry.line ?? 0),
    ...refValues
  );
  const frame = buildFrame({
    width,
    height,
    max: maxBars * barHeadroom,
    padB: 26,
    axisMax,
  });
  const band = frame.iw / n;
  const groupWidth = Math.min(40, (band * 0.6) / keys.length);
  const refLayout = refLines ? layoutRefLines(frame, refLines) : [];
  return (
    <svg
      aria-label="Comparativa por categoría"
      ref={ref}
      role="img"
      style={SVG_STYLE}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Axis fmt={fmt} frame={frame} />
      {refLayout.length > 0 ? <RefLineMarks frame={frame} layout={refLayout} /> : null}
      {data.map((entry, i) => {
        const cx = frame.padL + band * i + band / 2;
        const total = groupWidth * keys.length + 4 * (keys.length - 1);
        return (
          <g key={entry.label}>
            {entry.values.map((value, j) => {
              const x = cx - total / 2 + j * (groupWidth + 4);
              const y = frame.y(value);
              return (
                <rect
                  fill={barColorFn ? barColorFn(i) : colors[j % colors.length]}
                  height={Math.max(0, frame.padT + frame.ih - y)}
                  key={keys[j]}
                  rx={2}
                  width={groupWidth}
                  x={x}
                  y={y}
                >
                  <title>{`${entry.label} · ${keys[j] ?? ""} · ${fmt(value)}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
      {hasLine ? (
        <>
          <path
            d={data
              .map(
                (entry, i) =>
                  `${i ? "L" : "M"}${(frame.padL + band * i + band / 2).toFixed(1)} ${frame.y(entry.line ?? 0).toFixed(1)}`
              )
              .join(" ")}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
          />
          {data.map((entry, i) => (
            <circle
              cx={frame.padL + band * i + band / 2}
              cy={frame.y(entry.line ?? 0)}
              fill="var(--color-surface)"
              key={entry.label}
              r={3.5}
              stroke={lineColor}
              strokeWidth={2}
            >
              <title>{`${entry.label} · ${lineLabel ?? "Línea"} · ${lineFmt(entry.line ?? 0)}`}</title>
            </circle>
          ))}
        </>
      ) : null}
      {refLayout.length > 0 ? <RefLineLabels frame={frame} layout={refLayout} /> : null}
      <XLabels frame={frame} labels={data.map((entry) => entry.label)} />
    </svg>
  );
}

/** Barras divergentes alrededor de un eje cero, con eje etiquetado a ambos lados. */
export function VarianceChart({
  values,
  labels,
  height = 220,
  fmt = formatCompact,
  positiveColor = CHART_COLOR.positive,
  negativeColor = CHART_COLOR.negative,
}: {
  values: readonly number[];
  labels: readonly string[];
  height?: number;
  fmt?: (value: number) => string;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const [ref, width] = useMeasuredWidth();
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value))) * 1.12;
  const padL = 50,
    padR = 12,
    padT = 12,
    padB = 24;
  const iw = width - padL - padR,
    ih = height - padT - padB;
  const zero = padT + ih / 2;
  const y = (value: number) => zero - (ih / 2) * (value / maxAbs);
  const band = iw / (values.length || 1);
  const barWidth = Math.min(26, band * 0.62);
  return (
    <svg
      aria-label="Variación por periodo"
      ref={ref}
      role="img"
      style={SVG_STYLE}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line stroke="var(--color-border)" strokeWidth={1} x1={padL} x2={padL + iw} y1={zero} y2={zero} />
      {[1, -1].flatMap((sign) =>
        [0.5, 1].map((fraction) => {
          const value = maxAbs * fraction * sign;
          const yy = y(value);
          return (
            <g key={`${sign}-${fraction}`}>
              <line
                stroke="var(--color-border)"
                strokeOpacity={0.45}
                x1={padL}
                x2={padL + iw}
                y1={yy}
                y2={yy}
              />
              <text
                fill="var(--color-text-muted)"
                fontSize={CHART_FONT.tick}
                textAnchor="end"
                x={padL - 8}
                y={yy + 3}
              >
                {sign > 0 ? "+" : "−"}
                {fmt(Math.abs(value))}
              </text>
            </g>
          );
        })
      )}
      {values.map((value, index) => {
        const x = padL + band * index + band / 2 - barWidth / 2;
        const yv = y(value);
        return (
          <rect
            fill={value >= 0 ? positiveColor : negativeColor}
            fillOpacity={0.85}
            height={Math.max(1.5, Math.abs(zero - yv))}
            key={labels[index] ?? index}
            rx={2}
            width={barWidth}
            x={x}
            y={Math.min(zero, yv)}
          >
            <title>{`${labels[index] ?? ""} · ${value > 0 ? "+" : value < 0 ? "−" : ""}${fmt(Math.abs(value))}`}</title>
          </rect>
        );
      })}
      {labels.map((label, index) => {
        const step = Math.max(1, Math.ceil(labels.length / 7));
        if (index % step !== 0 && index !== labels.length - 1) return null;
        return (
          <text
            fill="var(--color-text-muted)"
            fontSize={CHART_FONT.tick}
            key={`${label}-${index}`}
            textAnchor="middle"
            x={padL + band * index + band / 2}
            y={height - 6}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export interface DivergingDatum {
  label: string;
  /** Se apila hacia arriba desde cero. */
  positive: number;
  /** Magnitud positiva; se apila hacia abajo desde cero. */
  negative: number;
}

/**
 * Dos magnitudes por categoría, una encima y otra debajo del cero.
 *
 * No existe en marketing-app. Hace falta para "Distribución de puntos": puntos
 * a favor y en contra del MISMO día tienen que verse como una sola columna
 * partida por el cero, no como dos barras sueltas — el ojo lee así el saldo
 * neto sin restar mentalmente.
 *
 * Se distingue de VarianceChart en que allí hay un valor por categoría (el
 * neto) y aquí hay dos (los dos brutos que lo componen).
 */
export function DivergingStackedChart({
  data,
  height = 230,
  fmt = formatCompact,
  positiveLabel = "A favor",
  negativeLabel = "En contra",
  positiveColor = CHART_COLOR.win,
  negativeColor = CHART_COLOR.loss,
}: {
  data: readonly DivergingDatum[];
  height?: number;
  fmt?: (value: number) => string;
  positiveLabel?: string;
  negativeLabel?: string;
  positiveColor?: string;
  negativeColor?: string;
}) {
  const [ref, width] = useMeasuredWidth();
  const maxAbs =
    Math.max(1, ...data.map((d) => Math.max(d.positive, Math.abs(d.negative)))) * 1.12;
  const padL = 50,
    padR = 12,
    padT = 12,
    padB = 24;
  const iw = width - padL - padR,
    ih = height - padT - padB;
  const zero = padT + ih / 2;
  const y = (value: number) => zero - (ih / 2) * (value / maxAbs);
  const band = iw / (data.length || 1);
  const barWidth = Math.min(26, band * 0.62);
  return (
    <svg
      aria-label="Composición por categoría alrededor de cero"
      ref={ref}
      role="img"
      style={SVG_STYLE}
      viewBox={`0 0 ${width} ${height}`}
    >
      {[1, -1].flatMap((sign) =>
        [0.5, 1].map((fraction) => {
          const value = maxAbs * fraction * sign;
          const yy = y(value);
          return (
            <g key={`${sign}-${fraction}`}>
              <line
                stroke="var(--color-border)"
                strokeOpacity={0.45}
                x1={padL}
                x2={padL + iw}
                y1={yy}
                y2={yy}
              />
              <text
                fill="var(--color-text-muted)"
                fontSize={CHART_FONT.tick}
                textAnchor="end"
                x={padL - 8}
                y={yy + 3}
              >
                {sign > 0 ? "+" : "−"}
                {fmt(Math.abs(value))}
              </text>
            </g>
          );
        })
      )}
      <line stroke="var(--color-border)" strokeWidth={1} x1={padL} x2={padL + iw} y1={zero} y2={zero} />
      {data.map((d, index) => {
        const cx = padL + band * index + band / 2;
        const x = cx - barWidth / 2;
        const topY = y(d.positive);
        const bottomY = y(-Math.abs(d.negative));
        return (
          <g key={d.label}>
            <rect
              fill={positiveColor}
              fillOpacity={0.9}
              height={Math.max(0, zero - topY)}
              rx={2}
              width={barWidth}
              x={x}
              y={topY}
            >
              <title>{`${d.label} · ${positiveLabel} · ${fmt(d.positive)}`}</title>
            </rect>
            <rect
              fill={negativeColor}
              fillOpacity={0.9}
              height={Math.max(0, bottomY - zero)}
              rx={2}
              width={barWidth}
              x={x}
              y={zero}
            >
              <title>{`${d.label} · ${negativeLabel} · ${fmt(Math.abs(d.negative))}`}</title>
            </rect>
          </g>
        );
      })}
      {data.map((d, index) => {
        const step = Math.max(1, Math.ceil(data.length / 7));
        if (index % step !== 0 && index !== data.length - 1) return null;
        return (
          <text
            fill="var(--color-text-muted)"
            fontSize={CHART_FONT.tick}
            key={d.label}
            textAnchor="middle"
            x={padL + band * index + band / 2}
            y={height - 6}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Donut con total en el centro y leyenda con valor y porcentaje, no solo puntos de color. */
export function DonutChart({
  data,
  size = 168,
  centerLabel,
  centerSub,
  fmt = formatCompact,
}: {
  data: readonly DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerSub?: string;
  fmt?: (value: number) => string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = size / 2 - 4;
  const inner = radius * 0.62;
  const cx = size / 2,
    cy = size / 2;
  let angle = -Math.PI / 2;
  const arcs = data.map((slice) => {
    const share = slice.value / total;
    const next = angle + share * Math.PI * 2;
    const large = next - angle > Math.PI ? 1 : 0;
    const d = `M${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)} A${radius} ${radius} 0 ${large} 1 ${cx + radius * Math.cos(next)} ${cy + radius * Math.sin(next)} L${cx + inner * Math.cos(next)} ${cy + inner * Math.sin(next)} A${inner} ${inner} 0 ${large} 0 ${cx + inner * Math.cos(angle)} ${cy + inner * Math.sin(angle)} Z`;
    angle = next;
    return { d, slice, share };
  });
  return (
    <div className="cj-donut-layout">
      <svg
        aria-label="Distribución"
        role="img"
        style={{ display: "block", flex: "none", height: size, width: size }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {arcs.map(({ d, slice, share }) => (
          <path
            d={d}
            fill={slice.color}
            key={slice.label}
            stroke="var(--color-surface)"
            strokeWidth={1.5}
          >
            <title>{`${slice.label} · ${fmt(slice.value)} · ${(share * 100).toFixed(1)}%`}</title>
          </path>
        ))}
        {centerLabel ? (
          <text
            fill="var(--color-text)"
            fontSize={CHART_FONT.hero}
            fontWeight={600}
            textAnchor="middle"
            x={cx}
            y={cy - 1}
          >
            {centerLabel}
          </text>
        ) : null}
        {centerSub ? (
          <text
            fill="var(--color-text-muted)"
            fontSize={CHART_FONT.tick}
            textAnchor="middle"
            x={cx}
            y={cy + 15}
          >
            {centerSub}
          </text>
        ) : null}
      </svg>
      <div className="cj-donut-legend">
        {arcs.map(({ slice, share }) => (
          <span key={slice.label}>
            <i style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <b>{fmt(slice.value)}</b>
            <strong>{(share * 100).toFixed(1)}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface QuadrantPoint {
  label: string;
  x: number;
  y: number;
  color?: string;
}

export interface QuadrantLabel {
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
}

/**
 * Dos métricas cruzadas: los cuatro cuadrantes SON la lectura.
 *
 * A diferencia del original, aquí los divisores no son las medianas sino
 * umbrales que se pasan explícitamente (`xDivider`, `yDivider`): en el Tracker
 * los cuadrantes significan "por encima del 50 % de acierto" y "por encima de
 * 1,5 de R/B", que son objetivos fijos, no lo que haya salido este año. Con la
 * mediana, un año malo entero se vería como si la mitad de los meses fueran
 * buenos.
 */
export function QuadrantChart({
  points,
  xLabel,
  yLabel,
  xFmt = formatCompact,
  yFmt = formatCompact,
  height = 300,
  xDivider,
  yDivider,
  xDomain,
  quadrantLabels,
}: {
  points: readonly QuadrantPoint[];
  xLabel: string;
  yLabel: string;
  xFmt?: (value: number) => string;
  yFmt?: (value: number) => string;
  height?: number;
  xDivider?: number;
  yDivider?: number;
  /** Fija el rango del eje X. Sin él se ajusta a los datos. */
  xDomain?: readonly [number, number];
  quadrantLabels?: QuadrantLabel;
}) {
  const [ref, width] = useMeasuredWidth();
  const xs = points.map((point) => point.x),
    ys = points.map((point) => point.y);
  const x0 = xDomain ? xDomain[0] : Math.min(...xs, xDivider ?? Infinity) * 0.9;
  const x1 = xDomain ? xDomain[1] : Math.max(...xs, xDivider ?? -Infinity) * 1.08 || 1;
  const y0 = 0;
  const y1 = Math.max(...ys, yDivider ?? 0) * 1.15 || 1;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => y0 + (y1 - y0) * fraction);
  /*
   * El título rotado del eje Y ocupa una franja de ~20 px a la izquierda, así
   * que el área de dibujo tiene que empezar más allá de esa franja MÁS la
   * etiqueta de marca más ancha; si no, los valores largos la atraviesan.
   */
  const yTickWidth =
    Math.max(...yTicks.map((value) => yFmt(value).length)) * CHART_FONT.tick * 0.62;
  const padL = Math.max(54, Math.round(yTickWidth + 32)),
    padR = 16,
    padT = 16,
    padB = 38;
  const iw = width - padL - padR,
    ih = height - padT - padB;
  const X = (value: number) => padL + ((value - x0) / (x1 - x0 || 1)) * iw;
  const Y = (value: number) => padT + ih - ((value - y0) / (y1 - y0 || 1)) * ih;
  return (
    <svg
      aria-label="Relación entre dos métricas"
      ref={ref}
      role="img"
      style={SVG_STYLE}
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect fill="none" height={ih} stroke="var(--color-border)" width={iw} x={padL} y={padT} />
      {xDivider != null ? (
        <line
          stroke="var(--color-positive)"
          strokeDasharray="3 4"
          strokeOpacity={0.7}
          x1={X(xDivider)}
          x2={X(xDivider)}
          y1={padT}
          y2={padT + ih}
        />
      ) : null}
      {yDivider != null ? (
        <line
          stroke="var(--color-positive)"
          strokeDasharray="3 4"
          strokeOpacity={0.7}
          x1={padL}
          x2={padL + iw}
          y1={Y(yDivider)}
          y2={Y(yDivider)}
        />
      ) : null}
      {quadrantLabels ? (
        <>
          {quadrantLabels.q1 ? (
            <text
              fill="var(--color-text-muted)"
              fillOpacity={0.5}
              fontSize={CHART_FONT.tick}
              textAnchor="end"
              x={padL + iw - 6}
              y={padT + 14}
            >
              {quadrantLabels.q1}
            </text>
          ) : null}
          {quadrantLabels.q2 ? (
            <text
              fill="var(--color-text-muted)"
              fillOpacity={0.5}
              fontSize={CHART_FONT.tick}
              x={padL + 6}
              y={padT + 14}
            >
              {quadrantLabels.q2}
            </text>
          ) : null}
          {quadrantLabels.q3 ? (
            <text
              fill="var(--color-text-muted)"
              fillOpacity={0.5}
              fontSize={CHART_FONT.tick}
              x={padL + 6}
              y={padT + ih - 6}
            >
              {quadrantLabels.q3}
            </text>
          ) : null}
          {quadrantLabels.q4 ? (
            <text
              fill="var(--color-text-muted)"
              fillOpacity={0.5}
              fontSize={CHART_FONT.tick}
              textAnchor="end"
              x={padL + iw - 6}
              y={padT + ih - 6}
            >
              {quadrantLabels.q4}
            </text>
          ) : null}
        </>
      ) : null}
      {yTicks.map((value, index) => (
        <text
          fill="var(--color-text-muted)"
          fontSize={CHART_FONT.tick}
          key={index}
          textAnchor="end"
          x={padL - 8}
          y={Y(value) + 3}
        >
          {yFmt(value)}
        </text>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <text
          fill="var(--color-text-muted)"
          fontSize={CHART_FONT.tick}
          key={fraction}
          textAnchor="middle"
          x={X(x0 + (x1 - x0) * fraction)}
          y={padT + ih + 14}
        >
          {xFmt(x0 + (x1 - x0) * fraction)}
        </text>
      ))}
      {points.map((point) => {
        const color = point.color ?? CHART_COLOR.accent;
        return (
          <g key={point.label}>
            <circle
              cx={X(point.x)}
              cy={Y(point.y)}
              fill={color}
              fillOpacity={0.5}
              r={7}
              stroke={color}
              strokeWidth={1.5}
            >
              <title>{`${point.label} · ${xLabel} ${xFmt(point.x)} · ${yLabel} ${yFmt(point.y)}`}</title>
            </circle>
            <text
              fill="var(--color-text-muted)"
              fontSize={CHART_FONT.tick}
              textAnchor="middle"
              x={X(point.x)}
              y={Math.max(padT + 9, Y(point.y) - 12)}
            >
              {point.label}
            </text>
          </g>
        );
      })}
      <text
        fill="var(--color-text-muted)"
        fontSize={CHART_FONT.label}
        textAnchor="middle"
        x={padL + iw / 2}
        y={height - 6}
      >
        {xLabel}
      </text>
      <text
        fill="var(--color-text-muted)"
        fontSize={CHART_FONT.label}
        textAnchor="middle"
        transform={`rotate(-90 12 ${padT + ih / 2})`}
        x={12}
        y={padT + ih / 2}
      >
        {yLabel}
      </text>
    </svg>
  );
}

/**
 * Medidor semicircular.
 *
 * No viene de marketing-app: allí no hay ninguno. Se conserva el del original
 * en Streamlit porque el Tracker lo usa para dar contexto de un objetivo
 * conocido, pero reescrito como arco SVG en la misma gramática que el resto —
 * antes era un RadialBarChart de Recharts, y era la única razón por la que la
 * librería seguía haciendo falta en esa pantalla.
 *
 * El arco solo da contexto: el número escrito debajo es lo que se lee.
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
  const size = 190,
    stroke = 14;
  const cx = size / 2,
    cy = 104,
    r = 78;
  const acotado = Math.max(0, Math.min(max, valor));
  const fraccion = max > 0 ? acotado / max : 0;
  // Semicírculo de 180° a 0°, recorrido en sentido horario desde la izquierda.
  const angle = Math.PI - fraccion * Math.PI;
  const arc = (a0: number, a1: number) =>
    `M${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A${r} ${r} 0 ${a0 - a1 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  return (
    <div className="cj-gauge">
      <div className="cj-section-label">{label}</div>
      <svg
        aria-label={`${label}: ${formato(valor)}`}
        role="img"
        style={{ display: "block", height: 118, width: "100%", maxWidth: size }}
        viewBox={`0 0 ${size} 118`}
      >
        <path
          d={arc(Math.PI, 0)}
          fill="none"
          stroke="var(--surface-2)"
          strokeLinecap="round"
          strokeWidth={stroke}
        />
        {fraccion > 0 ? (
          <path
            d={arc(Math.PI, angle)}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth={stroke}
          />
        ) : null}
      </svg>
      <div className="cj-gauge__value" style={{ color }}>
        {formato(valor)}
      </div>
    </div>
  );
}

export function ChartLegend({
  items,
}: {
  items: readonly { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <div className="cj-chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i
            style={
              item.dashed
                ? { background: "transparent", borderTop: `2px dashed ${item.color}` }
                : { background: item.color }
            }
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
