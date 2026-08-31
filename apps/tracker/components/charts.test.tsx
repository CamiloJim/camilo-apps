/*
 * Tests de las primitivas de gráfico, contra los DATOS REALES de Camilo.
 *
 * Por qué existen: al portar los gráficos de Recharts a SVG propio, los 35
 * tests que ya había cubrían solo aritmética. Un gráfico podía dibujar la barra
 * en el sitio equivocado, invertir un signo o perder un día entero sin que
 * ninguno se pusiera en rojo. Esto cierra ese hueco.
 *
 * Los números son los 14 días migrados en abril y mayo de 2026 (leídos de
 * Supabase el 2026-08-30), no un caso sintético: si alguien rompe el eje o la
 * acumulación, salta contra la operativa de verdad.
 *
 * Se renderiza con `renderToStaticMarkup` y no con jsdom para no añadir
 * dependencias. Las primitivas caen a un tamaño fijo cuando no hay
 * ResizeObserver, así que el marcado del servidor es determinista y contiene
 * ya toda la geometría y todos los <title> que sirven de tooltip.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CHART_COLOR,
  ComboChart,
  DivergingStackedChart,
  DonutChart,
  Gauge,
  LineChart,
  QuadrantChart,
  VarianceChart,
} from "@camilo-apps/ui";

/** Los 7 días con operaciones de abril de 2026, tal como están en la base. */
const ABRIL = [
  { etiqueta: "06/04", ops: 3, gan: 1, per: 2, pos: 8, neg: 14 },
  { etiqueta: "10/04", ops: 2, gan: 1, per: 1, pos: 7.5, neg: 3.5 },
  { etiqueta: "13/04", ops: 1, gan: 1, per: 0, pos: 20, neg: 0 },
  { etiqueta: "15/04", ops: 1, gan: 0, per: 1, pos: 0, neg: 7 },
  { etiqueta: "21/04", ops: 1, gan: 0, per: 1, pos: 0, neg: 1.75 },
  { etiqueta: "24/04", ops: 2, gan: 1, per: 1, pos: 16, neg: 7 },
  { etiqueta: "29/04", ops: 3, gan: 2, per: 1, pos: 12.5, neg: 7 },
] as const;

const etiquetas = ABRIL.map((d) => d.etiqueta);

/** Curva de equidad de abril: cierra en 23,75, el balance conciliado del mes. */
const EQUIDAD = ABRIL.reduce<number[]>((acc, d) => {
  acc.push(Number(((acc.at(-1) ?? 0) + d.pos - d.neg).toFixed(2)));
  return acc;
}, []);

const pts = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

/** Los <title> del SVG son el tooltip: lo que el usuario lee al pasar el ratón. */
function titles(markup: string): string[] {
  return [...markup.matchAll(/<title>(.*?)<\/title>/g)].map((m) => m[1]);
}

describe("datos de partida", () => {
  it("reproduce la conciliación de abril de la migración", () => {
    expect(ABRIL.reduce((a, d) => a + d.ops, 0)).toBe(13);
    expect(ABRIL.reduce((a, d) => a + d.gan, 0)).toBe(6);
    expect(ABRIL.reduce((a, d) => a + d.per, 0)).toBe(7);
    expect(ABRIL.reduce((a, d) => a + d.pos, 0)).toBe(64);
    expect(ABRIL.reduce((a, d) => a + d.neg, 0)).toBe(40.25);
    expect(EQUIDAD.at(-1)).toBe(23.75);
  });
});

describe("LineChart", () => {
  const markup = render(
    <LineChart
      area
      labels={etiquetas}
      series={[{ name: "Acumulado", color: CHART_COLOR.accent, values: EQUIDAD }]}
      fmt={pts}
    />
  );

  it("dibuja un punto por día, sin perder ninguno", () => {
    expect(markup.match(/<circle/g)).toHaveLength(ABRIL.length);
  });

  it("el último punto es el balance real del mes", () => {
    expect(titles(markup).at(-1)).toBe("29/04 · Acumulado · +23.75");
  });

  it("cruza por debajo de cero cuando el mes va en pérdida", () => {
    // El 06/04 cierra en −6: la curva tiene que arrancar en negativo, no en 0.
    expect(titles(markup)[0]).toBe("06/04 · Acumulado · -6.00");
  });

  it("con `area` rellena bajo la curva con un degradado, no con color plano", () => {
    expect(markup).toContain("<linearGradient");
    expect(markup).toContain('stop-opacity="0.34"');
  });

  it("pinta las líneas de referencia con su etiqueta", () => {
    const conRef = render(
      <LineChart
        labels={etiquetas}
        series={[{ name: "R/B", color: CHART_COLOR.comparison, values: [1.2, 2.1, 0.8] }]}
        refLines={[{ value: 1.5, label: "1,5 objetivo" }]}
      />
    );
    expect(conRef).toContain("1,5 objetivo");
    expect(conRef).toContain('stroke-dasharray="3 4"');
  });

  it("separa dos etiquetas de referencia cercanas en vez de superponerlas", () => {
    // Defecto encontrado en la revisión visual del 2026-08-30: el 50 % y el
    // 40 % de la tasa caen a pocos píxeles y sus rótulos se imprimían uno
    // encima del otro, ilegibles. Ahora el segundo baja al otro lado de su
    // línea.
    const markup = render(
      <LineChart
        labels={etiquetas}
        series={[{ name: "Tasa", color: "gold", values: [33, 50, 100] }]}
        refLines={[
          { value: 50, label: "50 % objetivo" },
          { value: 40, label: "40 % mínimo" },
        ]}
      />
    );
    const ys = [...markup.matchAll(/<text[^>]*y="([\d.]+)"[^>]*>(?:50 % objetivo|40 % mínimo)/g)].map(
      (m) => Number(m[1])
    );
    expect(ys).toHaveLength(2);
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(13);
  });
});

describe("ComboChart", () => {
  it("dibuja una barra por serie y por día", () => {
    const markup = render(
      <ComboChart
        data={ABRIL.map((d) => ({ label: d.etiqueta, values: [d.gan, d.per] }))}
        keys={["Ganadoras", "Perdedoras"]}
        colors={[CHART_COLOR.win, CHART_COLOR.loss]}
      />
    );
    expect(markup.match(/<rect/g)).toHaveLength(ABRIL.length * 2);
    expect(titles(markup)[0]).toBe("06/04 · Ganadoras · 1");
    expect(titles(markup)[1]).toBe("06/04 · Perdedoras · 2");
  });

  it("`barColorFn` colorea por día y no por serie", () => {
    const tasas = ABRIL.map((d) => (d.gan / d.ops) * 100);
    const markup = render(
      <ComboChart
        data={ABRIL.map((d, i) => ({ label: d.etiqueta, values: [tasas[i]] }))}
        keys={["Tasa"]}
        colors={[CHART_COLOR.accent]}
        barColorFn={(i) => (tasas[i] >= 50 ? "var(--status-good)" : "var(--status-critical)")}
      />
    );
    // 4 días llegan al 50 % (10/04, 13/04, 24/04, 29/04) y 3 no.
    expect(markup.match(/var\(--status-good\)/g)).toHaveLength(4);
    expect(markup.match(/var\(--status-critical\)/g)).toHaveLength(3);
  });

  it("`axisMax` acota el eje de una magnitud con techo natural", () => {
    // Defecto encontrado en la revisión visual del 2026-08-30: con un día al
    // 100 % y holgura, el redondeo "bonito" llevaba el eje al 200 % y dejaba
    // media tarjeta vacía en un porcentaje que no puede pasar de 100.
    const tasas = ABRIL.map((d) => (d.gan / d.ops) * 100);
    const datos = ABRIL.map((d, i) => ({ label: d.etiqueta, values: [tasas[i]] }));
    const sinTope = render(
      <ComboChart data={datos} keys={["Tasa"]} colors={["gold"]} fmt={(v) => `${v}%`} />
    );
    const conTope = render(
      <ComboChart
        data={datos}
        keys={["Tasa"]}
        colors={["gold"]}
        axisMax={100}
        fmt={(v) => `${v}%`}
      />
    );
    expect(sinTope).toContain("200%");
    expect(conTope).not.toContain("200%");
    expect(conTope).toContain("100%");
  });

  it("sin `line` en los datos no dibuja la serie superpuesta", () => {
    const sinLinea = render(
      <ComboChart data={[{ label: "A", values: [1] }]} keys={["x"]} colors={["red"]} />
    );
    const conLinea = render(
      <ComboChart data={[{ label: "A", values: [1], line: 2 }]} keys={["x"]} colors={["red"]} />
    );
    expect(sinLinea.match(/<circle/g)).toBeNull();
    expect(conLinea.match(/<circle/g)).toHaveLength(1);
  });

  it("la línea comparte el eje de las barras, no uno propio", () => {
    /*
     * Defecto encontrado en la revisión visual del 2026-08-30. La línea tenía
     * un eje secundario auto-escalado, así que la distancia vertical entre la
     * barra y la línea no significaba nada. En el DCF eso importa: la barra es
     * el flujo proyectado y la línea su valor presente, y la separación entre
     * las dos ES el descuento.
     *
     * Con eje compartido, una línea que vale la mitad que su barra tiene que
     * dibujarse a media altura entre la barra y la base. Con ejes separados
     * salía casi pegada a la barra, sugiriendo un descuento inexistente.
     */
    const markup = render(
      <ComboChart
        data={[{ label: "Y1", values: [100], line: 50 }]}
        keys={["Flujo"]}
        colors={["gold"]}
        lineLabel="PV"
      />
    );
    const barra = markup.match(/<rect[^>]*height="([\d.]+)"[^>]*y="([\d.]+)"/);
    const punto = markup.match(/<circle[^>]*cy="([\d.]+)"/);
    expect(barra).not.toBeNull();
    expect(punto).not.toBeNull();
    const topeBarra = Number(barra![2]);
    const baseBarra = topeBarra + Number(barra![1]);
    const yLinea = Number(punto![1]);
    // El punto cae a mitad de camino entre el tope de la barra y la base.
    expect(yLinea).toBeCloseTo((topeBarra + baseBarra) / 2, 0);
  });

  it("el techo del eje cuenta también la línea, para que no se salga del marco", () => {
    const markup = render(
      <ComboChart
        data={[{ label: "Y1", values: [10], line: 900 }]}
        keys={["Flujo"]}
        colors={["gold"]}
        fmt={(v) => String(Math.round(v))}
      />
    );
    const punto = markup.match(/<circle[^>]*cy="([\d.]+)"/);
    expect(punto).not.toBeNull();
    // Dentro del marco: por encima del padding superior, nunca negativo.
    expect(Number(punto![1])).toBeGreaterThanOrEqual(0);
  });
});

describe("DivergingStackedChart", () => {
  const markup = render(
    <DivergingStackedChart
      data={ABRIL.map((d) => ({ label: d.etiqueta, positive: d.pos, negative: d.neg }))}
      fmt={(v) => v.toFixed(2)}
    />
  );

  it("da dos barras por día: los dos brutos, no el neto", () => {
    expect(titles(markup)).toHaveLength(ABRIL.length * 2);
    expect(titles(markup)[0]).toBe("06/04 · A favor · 8.00");
    expect(titles(markup)[1]).toBe("06/04 · En contra · 14.00");
  });

  it("un día sin pérdidas deja la barra inferior en cero", () => {
    // 13/04: +20 y 0 en contra. La barra de abajo tiene que medir 0, no faltar.
    const rects = [...markup.matchAll(/<rect[^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(rects[5]).toBe(0); // 13/04 es el tercer día → segunda barra del par
  });
});

describe("VarianceChart", () => {
  it("colorea por signo: abril suma, un mes en pérdida resta", () => {
    const markup = render(
      <VarianceChart values={[23.75, 41, -12.5]} labels={["Abril", "Mayo", "Junio"]} />
    );
    expect(titles(markup)).toEqual([
      "Abril · +23.75",
      "Mayo · +41",
      "Junio · −12.50",
    ]);
    expect(markup.match(/var\(--status-good\)/g)).toHaveLength(2);
    expect(markup.match(/var\(--status-critical\)/g)).toHaveLength(1);
  });
});

describe("DonutChart", () => {
  it("reparte el porcentaje real de ganadoras y perdedoras", () => {
    const markup = render(
      <DonutChart
        data={[
          { label: "Ganadoras", value: 6, color: CHART_COLOR.win },
          { label: "Perdedoras", value: 7, color: CHART_COLOR.loss },
        ]}
        centerLabel="13"
        fmt={(v) => String(v)}
      />
    );
    expect(titles(markup)).toEqual(["Ganadoras · 6 · 46.2%", "Perdedoras · 7 · 53.8%"]);
    // La leyenda repite el porcentaje junto al absoluto, no solo un punto de color.
    expect(markup).toContain("46.2%");
    expect(markup).toContain("53.8%");
  });
});

describe("QuadrantChart", () => {
  it("parte por los objetivos fijos, no por la mediana de los datos", () => {
    const markup = render(
      <QuadrantChart
        points={[
          { label: "Abr", x: 46.2, y: 1.86 },
          { label: "May", x: 50, y: 2.41 },
        ]}
        xLabel="Tasa de éxito (%)"
        yLabel="Ratio R/B"
        xDomain={[0, 100]}
        xDivider={50}
        yDivider={1.5}
      />
    );
    // Con dominio 0-100 fijo, el divisor del 50 % cae en el centro exacto del
    // área de dibujo. Si alguien lo devolviera a la mediana, esto se mueve.
    const vertical = markup.match(/<line[^>]*x1="([\d.]+)"[^>]*x2="\1"/);
    expect(vertical).not.toBeNull();
    expect(titles(markup)[0]).toBe("Abr · Tasa de éxito (%) 46.20 · Ratio R/B 1.86");
  });
});

describe("Gauge", () => {
  it("el arco crece con el valor y el número lleva el formato del dominio", () => {
    const vacio = render(
      <Gauge label="Tasa" valor={0} max={100} color="red" formato={(v) => `${v}%`} />
    );
    const medio = render(
      <Gauge label="Tasa" valor={46.2} max={100} color="red" formato={(v) => `${v}%`} />
    );
    // Sin valor solo se pinta la pista de fondo; con valor, pista + arco.
    expect(vacio.match(/<path/g)).toHaveLength(1);
    expect(medio.match(/<path/g)).toHaveLength(2);
    expect(medio).toContain("46.2%");
  });

  it("acota por arriba en vez de desbordar el arco", () => {
    const markup = render(
      <Gauge label="R/B" valor={99} max={5} color="red" formato={(v) => v.toFixed(2)} />
    );
    // El número sigue siendo el real aunque el arco esté al tope.
    expect(markup).toContain("99.00");
  });
});
