"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { RegistroPage } from "./pages/RegistroPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AnualPage } from "./pages/AnualPage";
import { ConfigPage } from "./pages/ConfigPage";
import { MESES, type ConfigMes } from "@/lib/trading/calc";
import {
  CONFIG_POR_DEFECTO,
  cargarConfigsDelAnio,
  cargarDiasDelAnio,
  guardarConfig,
  type MapaDias,
} from "@/lib/trading/data";

const PAGINAS = [
  { id: "registro", label: "Registro" },
  { id: "dashboard", label: "Dashboard mensual" },
  { id: "anual", label: "Resumen anual" },
  { id: "config", label: "Configuración" },
] as const;

type PaginaId = (typeof PAGINAS)[number]["id"];

/** El original fijaba YEAR = 2026. Aquí se toma del reloj para que no caduque. */
const ANIO = new Date().getUTCFullYear();

export function TrackerApp() {
  const [pagina, setPagina] = useState<PaginaId>("registro");
  const [mes, setMes] = useState(new Date().getUTCMonth() + 1);
  const [dias, setDias] = useState<MapaDias>({});
  const [configs, setConfigs] = useState<Record<number, ConfigMes>>({});
  const [cargando, setCargando] = useState(true);

  // Se carga el año entero de una vez: son ~250 filas como mucho, y evita ir a
  // la base cada vez que se cambia de mes o se abre el resumen anual.
  // `cargando` arranca en true y solo se apaga al terminar, para no llamar a
  // setState de forma sincrona dentro del efecto.
  const recargar = useCallback(async () => {
    const [d, c] = await Promise.all([cargarDiasDelAnio(ANIO), cargarConfigsDelAnio(ANIO)]);
    setDias(d);
    setConfigs(c);
    setCargando(false);
  }, []);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const [d, c] = await Promise.all([cargarDiasDelAnio(ANIO), cargarConfigsDelAnio(ANIO)]);
      if (!vigente) return; // el componente se desmontó mientras cargaba
      setDias(d);
      setConfigs(c);
      setCargando(false);
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const cfgMes = useMemo(() => configs[mes] ?? CONFIG_POR_DEFECTO, [configs, mes]);

  const actualizarConfig = useCallback(
    async (nueva: ConfigMes) => {
      setConfigs((prev) => ({ ...prev, [mes]: nueva }));
      await guardarConfig(ANIO, mes, nueva);
    },
    [mes]
  );

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] p-4">
        <div className="text-base font-semibold text-[var(--text-primary)]">
          📊 Trading Tracker
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Seguimiento {ANIO}</p>

        <nav className="mt-6 space-y-1" aria-label="Secciones">
          {PAGINAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPagina(p.id)}
              aria-current={pagina === p.id ? "page" : undefined}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                pagina === p.id
                  ? "bg-[var(--surface-2)] font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>

        {pagina !== "anual" && (
          <div className="mt-6">
            <label className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Mes activo
            </label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--series-1)]"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {PAGINAS.find((p) => p.id === pagina)?.label}
            {pagina !== "anual" && (
              <span className="ml-2 text-[var(--text-muted)]">
                — {MESES[mes - 1]} {ANIO}
              </span>
            )}
          </h1>
          <LogoutButton />
        </div>

        {cargando ? (
          <p className="text-sm text-[var(--text-secondary)]">Cargando…</p>
        ) : (
          <>
            {pagina === "registro" && (
              <RegistroPage
                anio={ANIO}
                mes={mes}
                dias={dias}
                setDias={setDias}
                cfg={cfgMes}
              />
            )}
            {pagina === "dashboard" && (
              <DashboardPage anio={ANIO} mes={mes} dias={dias} cfg={cfgMes} />
            )}
            {pagina === "anual" && <AnualPage dias={dias} configs={configs} />}
            {pagina === "config" && (
              <ConfigPage
                anio={ANIO}
                mes={mes}
                cfg={cfgMes}
                dias={dias}
                configs={configs}
                onConfigChange={actualizarConfig}
                onRecargar={recargar}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
