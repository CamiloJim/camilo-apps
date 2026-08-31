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
import { InputNum, Widget } from "../ui";

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
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Widget
        title={`Configuración de ${MESES[mes - 1]}`}
        meta="Se guarda por mes, no global: el balance inicial cambia de un mes a otro."
      >
        <div className="space-y-3">
          <div>
            <label className="cj-section-label mb-1 block">
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
            <label className="cj-section-label mb-1 block">
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
            <label className="cj-section-label mb-1 block">
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

        <p className="cj-widget__note rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
          El resultado en dólares se calcula como{" "}
          <span className="font-mono">puntos × contratos × {USD_POR_PUNTO}</span>, menos las
          comisiones. Esos {USD_POR_PUNTO} USD por punto corresponden al contrato de futuros
          que se opera; si cambia el instrumento, hay que ajustarlo en el código.
        </p>
      </Widget>

      <div className="space-y-4">
        <Widget
          title="Respaldo"
          meta="Mismo formato que la versión anterior: los respaldos antiguos siguen sirviendo."
        >
          <div className="flex flex-wrap gap-2">
            <button onClick={descargar} className="cj-button cj-button--secondary">
              Descargar JSON
            </button>
            <button
              onClick={() => inputFile.current?.click()}
              className="cj-button cj-button--secondary"
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
            <p className="cj-widget__note" role="status">
              {mensaje}
            </p>
          )}
        </Widget>

        <Widget title="Reiniciar datos">
          <p
            className="m-0 text-[length:var(--text-md)]"
            style={{ color: "var(--status-warning)" }}
          >
            Borra todos los registros de {anio}. No se puede deshacer — descarga un respaldo
            antes.
          </p>
          <label className="flex items-center gap-2 text-[length:var(--text-md)] text-[var(--text-secondary)]">
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
            className="cj-button self-start"
            style={{ background: "var(--status-critical)", color: "#fff" }}
          >
            Reiniciar
          </button>
        </Widget>

        <Widget title="Guía de métricas">
          <dl className="m-0 space-y-1.5 text-[length:var(--text-md)]">
            {[
              ["Tasa de éxito", "% de operaciones ganadoras. Meta: ≥ 50 %"],
              ["Ratio R/B", "Ganancia media ÷ pérdida media. Meta: ≥ 1,5"],
              ["Balance de puntos", "Suma de puntos a favor menos en contra"],
              ["Operativa eficiente", "Tasa ≥ 80 % y R/B ≥ 2"],
              ["Revisar errores", "Tasa < 40 % o R/B < 0,5"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="m-0 shrink-0 font-semibold" style={{ color: "var(--gold)" }}>
                  {k}:
                </dt>
                <dd className="m-0 text-[var(--text-secondary)]">{v}</dd>
              </div>
            ))}
          </dl>
        </Widget>
      </div>
    </div>
  );
}
