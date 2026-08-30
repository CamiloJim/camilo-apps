"use client";

import { useRef, useState } from "react";
import { MESES, USD_POR_PUNTO, type ConfigMes } from "@/lib/trading/calc";
import {
  aRespaldoJson,
  borrarAnio,
  importarRespaldo,
  type MapaDias,
  type RespaldoJson,
} from "@/lib/trading/data";
import { Card, InputNum, SectionLabel } from "../ui";

export function ConfigPage({
  anio,
  mes,
  cfg,
  dias,
  configs,
  onConfigChange,
  onRecargar,
}: {
  anio: number;
  mes: number;
  cfg: ConfigMes;
  dias: MapaDias;
  configs: Record<number, ConfigMes>;
  onConfigChange: (c: ConfigMes) => Promise<void>;
  onRecargar: () => Promise<void>;
}) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);

  function descargar() {
    const json = aRespaldoJson(dias, configs);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trading_tracker_${anio}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importar(file: File) {
    setMensaje(null);
    try {
      const texto = await file.text();
      const json = JSON.parse(texto) as RespaldoJson;
      const n = await importarRespaldo(anio, json);
      await onRecargar();
      setMensaje(`Importados ${n} días.`);
    } catch {
      setMensaje("No se pudo leer el archivo. ¿Es un respaldo válido?");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <SectionLabel>Configuración de {MESES[mes - 1]}</SectionLabel>
        <p className="mb-4 text-xs text-[var(--text-secondary)]">
          Se guarda por mes, no global: el balance inicial cambia de un mes a otro.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Balance inicial (USD)
            </label>
            <InputNum
              ariaLabel="Balance inicial"
              value={cfg.balanceInicial}
              step={100}
              onChange={(v) => void onConfigChange({ ...cfg, balanceInicial: v })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              N.º de contratos
            </label>
            <InputNum
              ariaLabel="Número de contratos"
              value={cfg.contratos}
              min={1}
              onChange={(v) => void onConfigChange({ ...cfg, contratos: Math.max(1, v) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Comisión por operación (USD)
            </label>
            <InputNum
              ariaLabel="Comisión por operación"
              value={cfg.comision}
              step={0.5}
              onChange={(v) => void onConfigChange({ ...cfg, comision: v })}
            />
          </div>
        </div>

        <p className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          El resultado en dólares se calcula como{" "}
          <span className="font-mono">puntos × contratos × {USD_POR_PUNTO}</span>, menos las
          comisiones. Esos {USD_POR_PUNTO} USD por punto corresponden al contrato de futuros
          que se opera; si cambia el instrumento, hay que ajustarlo en el código.
        </p>
      </Card>

      <div className="space-y-6">
        <Card>
          <SectionLabel>Respaldo</SectionLabel>
          <p className="mb-3 text-xs text-[var(--text-secondary)]">
            El archivo usa el mismo formato que la versión anterior, así que los respaldos
            antiguos siguen sirviendo.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={descargar}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--series-1)] hover:text-[var(--text-primary)]"
            >
              Descargar JSON
            </button>
            <button
              onClick={() => inputFile.current?.click()}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--series-1)] hover:text-[var(--text-primary)]"
            >
              Importar JSON
            </button>
            <input
              ref={inputFile}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
                e.target.value = "";
              }}
            />
          </div>
          {mensaje && (
            <p className="mt-3 text-xs text-[var(--text-secondary)]" role="status">
              {mensaje}
            </p>
          )}
        </Card>

        <Card>
          <SectionLabel>Reiniciar datos</SectionLabel>
          <p className="mb-3 text-xs" style={{ color: "var(--status-warning)" }}>
            Borra todos los registros de {anio}. No se puede deshacer — descarga un respaldo
            antes.
          </p>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Confirmo que quiero borrar todos los datos de {anio}
          </label>
          <button
            disabled={!confirmado}
            onClick={async () => {
              await borrarAnio(anio);
              await onRecargar();
              setConfirmado(false);
              setMensaje(`Datos de ${anio} borrados.`);
            }}
            className="mt-3 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--status-critical)" }}
          >
            Reiniciar
          </button>
        </Card>

        <Card>
          <SectionLabel>Guía de métricas</SectionLabel>
          <dl className="space-y-1.5 text-xs">
            {[
              ["Tasa de éxito", "% de operaciones ganadoras. Meta: ≥ 50 %"],
              ["Ratio R/B", "Ganancia media ÷ pérdida media. Meta: ≥ 1,5"],
              ["Balance de puntos", "Suma de puntos a favor menos en contra"],
              ["Operativa eficiente", "Tasa ≥ 80 % y R/B ≥ 2"],
              ["Revisar errores", "Tasa < 40 % o R/B < 0,5"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="shrink-0 font-medium" style={{ color: "var(--series-1)" }}>
                  {k}:
                </dt>
                <dd className="text-[var(--text-secondary)]">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
