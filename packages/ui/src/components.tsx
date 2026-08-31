// Componentes compartidos entre el Screener y el Trading Tracker.
//
// Solo vive aquí lo que usan LAS DOS apps. Lo que use una sola se queda en su
// propia carpeta: un paquete compartido con piezas de un solo consumidor es
// abstracción sin motivo.
//
// El estilo vive en ui.css (clases `cj-*`), no en atributos de utilidad: la
// anatomía de un widget es una decisión de diseño con nombre, y repetida a mano
// en catorce sitios se desincroniza a la primera edición.
"use client";

import type { ReactNode } from "react";

/**
 * Contenedor genérico. Es el `.cj-widget` sin cabecera, para bloques que no
 * necesitan título (mensajes vacíos, avisos, agrupaciones sueltas).
 *
 * Si el bloque tiene título, usa `Widget`: además de la cabecera te da el sitio
 * donde poner el *meta* y la nota al pie, que es donde se explica cómo leer la
 * cifra. Un gráfico sin esa explicación se malinterpreta.
 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`cj-widget ${className}`}>{children}</div>;
}

/**
 * Tarjeta con la anatomía completa de marketing-app.
 *
 * - `meta`: la aclaración de contexto, junto al título (periodo, unidad, n).
 * - `controls`: alternativas de la misma vista (no navegación).
 * - `note`: cómo leer lo que se está viendo, debajo del contenido.
 */
export function Widget({
  title,
  meta,
  note,
  controls,
  activeControl,
  onControlSelect,
  span,
  className = "",
  children,
}: {
  title: string;
  meta?: string;
  note?: ReactNode;
  controls?: readonly { id: string; label: string }[];
  activeControl?: string;
  onControlSelect?: (id: string) => void;
  /** Ancho dentro de una `.cj-widget-grid` de 12 columnas. */
  span?: 4 | 6 | 8 | 12;
  className?: string;
  children: ReactNode;
}) {
  const spanClass = span && span !== 12 ? `cj-span-${span}` : "";
  return (
    <article className={`cj-widget ${spanClass} ${className}`}>
      <header className="cj-widget__header">
        <div>
          <h3>{title}</h3>
          {meta && <small>{meta}</small>}
        </div>
        {controls && (
          <div className="cj-widget__controls">
            {controls.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={activeControl === c.id}
                onClick={() => onControlSelect?.(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </header>
      {children}
      {note && <p className="cj-widget__note">{note}</p>}
    </article>
  );
}

export function WidgetGrid({ children }: { children: ReactNode }) {
  return <div className="cj-widget-grid">{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="cj-section-label">{children}</div>;
}

export interface KpiItem {
  label: string;
  value: string;
  sub?: string;
  /** Color del valor. Solo para estado (bueno/malo), nunca para identidad de serie. */
  valueColor?: string;
  /** Serie para la microcurva de la derecha. Con menos de dos puntos no se dibuja. */
  spark?: readonly number[];
}

/**
 * Convierte una serie en los puntos de una polilínea de 86×22.
 *
 * El mínimo se ancla al menor valor de la propia serie, no a cero: la
 * microcurva sirve para ver la *forma* del periodo, y con base en cero una
 * serie que se mueve poco alrededor de un número grande sale plana.
 */
function sparkPoints(values: readonly number[]): string {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => `${(i / (values.length - 1 || 1)) * 83 + 2},${20 - ((v - min) / span) * 18}`)
    .join(" ");
}

/**
 * Los KPIs de un periodo en una sola caja dividida, no en N tarjetas sueltas:
 * son una lectura, no seis objetos independientes.
 */
export function KpiStrip({ items }: { items: readonly KpiItem[] }) {
  return (
    <div
      className="cj-kpi-strip"
      style={{ "--cj-kpi-cols": items.length } as React.CSSProperties}
    >
      {items.map((k) => {
        const spark = k.spark && k.spark.length > 1 ? sparkPoints(k.spark) : null;
        return (
          <article className={spark ? "has-spark" : undefined} key={k.label}>
            <div>
              <span>{k.label}</span>
              <strong style={k.valueColor ? { color: k.valueColor } : undefined}>{k.value}</strong>
              {k.sub && <small>{k.sub}</small>}
            </div>
            {spark && (
              <svg aria-hidden="true" viewBox="0 0 86 22">
                <polyline points={spark} />
              </svg>
            )}
          </article>
        );
      })}
    </div>
  );
}
