"use client";

import { useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { Badge, Card, KpiStrip, SectionLabel, fmtBillions, fmtPct, fmtX, fmtUsd } from "./ui";
import { ScreenerTab } from "./tabs/ScreenerTab";
import { FinancialsTab } from "./tabs/FinancialsTab";
import { DcfTab } from "./tabs/DcfTab";
import { SensitivityTab } from "./tabs/SensitivityTab";
import { DEFAULT_FILTERS, passesFilters, type ScreenerFilters } from "@/lib/finance/screener";
import type { TickerApiResponse } from "@/lib/types";

const TABS = ["Screener", "Financials", "DCF Model", "Sensitivity"] as const;
type Tab = (typeof TABS)[number];

export function ScreenerApp() {
  const [tickerInput, setTickerInput] = useState("");
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [useManualGrowth, setUseManualGrowth] = useState(false);
  const [manualGrowthPct, setManualGrowthPct] = useState(8);
  const [useManualWacc, setUseManualWacc] = useState(false);
  const [manualWaccPct, setManualWaccPct] = useState(9);

  const [tab, setTab] = useState<Tab>("Screener");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TickerApiResponse | null>(null);

  async function handleAnalyze() {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/ticker/${encodeURIComponent(ticker)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Error fetching ${ticker}`);
        setData(null);
      } else {
        setData(json as TickerApiResponse);
      }
    } catch {
      setError(`No se pudo conectar para analizar ${ticker}.`);
    } finally {
      setLoading(false);
    }
  }

  const passResult = data ? passesFilters(data.row, filters) : null;

  return (
    <div className="cj-shell">
      {/* Sidebar */}
      <aside className="cj-sidebar cj-sidebar--wide">
        <div className="cj-brand">
          <strong>
            DCF <em>Analyzer</em>
          </strong>
          <span>Valoración por flujos descontados</span>
        </div>

        <div>
          <SectionLabel>Ticker</SectionLabel>
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder="AAPL, MSFT, ADBE…"
            aria-label="Ticker"
            className="cj-input mt-1 font-mono"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="cj-button cj-button--primary mt-2 w-full"
          >
            {loading ? "Fetching…" : "Analyze →"}
          </button>
        </div>

        <div>
          <SectionLabel>DCF Parameters</SectionLabel>
          <div className="mt-2">
            <ToggleRow
              label="Manual Growth Rate"
              checked={useManualGrowth}
              onChange={setUseManualGrowth}
            />
            <NumberField
              value={manualGrowthPct}
              onChange={setManualGrowthPct}
              min={-30}
              max={50}
              step={0.5}
              disabled={!useManualGrowth}
              suffix="%"
            />
          </div>
          <div className="mt-3">
            <ToggleRow label="Manual WACC" checked={useManualWacc} onChange={setUseManualWacc} />
            <NumberField
              value={manualWaccPct}
              onChange={setManualWaccPct}
              min={1}
              max={30}
              step={0.25}
              disabled={!useManualWacc}
              suffix="%"
            />
          </div>
        </div>

        <div>
          <button
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className="cj-section-label mb-2 flex w-full items-center justify-between"
        >
            Screener Filters
            <span>{filtersOpen ? "−" : "+"}</span>
          </button>
          {filtersOpen && (
            <div className="space-y-2">
            <FilterField
              label="Max P/E"
              value={filters.maxPeRatio}
              onChange={(v) => setFilters((f) => ({ ...f, maxPeRatio: v }))}
            />
            <FilterField
              label="Max P/B"
              value={filters.maxPbRatio}
              onChange={(v) => setFilters((f) => ({ ...f, maxPbRatio: v }))}
            />
            <FilterField
              label="Max EV/EBITDA"
              value={filters.maxEvEbitda}
              onChange={(v) => setFilters((f) => ({ ...f, maxEvEbitda: v }))}
            />
            <FilterField
              label="Min Profit Margin %"
              value={filters.minProfitMargin * 100}
              onChange={(v) => setFilters((f) => ({ ...f, minProfitMargin: v / 100 }))}
            />
            <FilterField
              label="Min ROE %"
              value={filters.minRoe * 100}
              onChange={(v) => setFilters((f) => ({ ...f, minRoe: v / 100 }))}
            />
            <FilterField
              label="Min ROA %"
              value={filters.minRoa * 100}
              onChange={(v) => setFilters((f) => ({ ...f, minRoa: v / 100 }))}
            />
            <FilterField
              label="Min Revenue Growth %"
              value={filters.minRevenueGrowth * 100}
              onChange={(v) => setFilters((f) => ({ ...f, minRevenueGrowth: v / 100 }))}
            />
            <FilterField
              label="Min Earnings Growth %"
              value={filters.minEarningsGrowth * 100}
              onChange={(v) => setFilters((f) => ({ ...f, minEarningsGrowth: v / 100 }))}
            />
            <FilterField
                label="Max Debt/Equity"
                value={filters.maxDebtToEquity}
                onChange={(v) => setFilters((f) => ({ ...f, maxDebtToEquity: v }))}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="cj-main">
        <div className="cj-page-header">
          <h1>
            {data ? (
              <>
                {data.row.ticker}
                <span> — {data.row.name}</span>
              </>
            ) : (
              "Análisis"
            )}
          </h1>
          <LogoutButton />
        </div>

        {error && (
          <Card className="border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10">
            <p className="text-sm text-[var(--status-critical)]">{error}</p>
          </Card>
        )}

        {!data && !loading && !error && <Landing />}

        {data && passResult && (
          <>
            <div className="flex items-baseline gap-3">
              <Badge status={passResult.passed ? "pass" : "fail"} />
              <span className="font-mono text-[length:var(--text-sm)] text-[var(--text-secondary)]">
                {data.row.sector}
              </span>
            </div>

            <KpiStrip
              items={[
                { label: "Price", value: fmtUsd(data.row.price) },
                { label: "Market Cap", value: fmtBillions(data.row.marketCap) },
                { label: "P/E Ratio", value: fmtX(data.row.peRatio) },
                { label: "P/B Ratio", value: fmtX(data.row.pbRatio) },
                { label: "ROE", value: fmtPct(data.row.roe) },
                { label: "Profit Margin", value: fmtPct(data.row.profitMargin) },
              ]}
            />

            <div className="cj-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "Screener" && (
              <ScreenerTab
                row={data.row}
                passed={passResult.passed}
                failures={passResult.failures}
              />
            )}
            {tab === "Financials" && <FinancialsTab hist={data.hist} />}
            {tab === "DCF Model" && (
              <DcfTab
                hist={data.hist}
                wacc={data.wacc}
                riskFree={data.riskFree}
                price={data.row.price}
                shares={data.shares}
                manualGrowth={useManualGrowth ? manualGrowthPct : null}
                manualWacc={useManualWacc ? manualWaccPct : null}
              />
            )}
            {tab === "Sensitivity" && (
              <SensitivityTab
                hist={data.hist}
                wacc={data.wacc}
                price={data.row.price}
                shares={data.shares}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Landing() {
  const items = [
    ["🔍", "Screener", "Valuation, profitability & growth filters"],
    ["📊", "Financials", "5-year income, cash flow & balance history"],
    ["💹", "DCF Model", "10-year intrinsic value with margin of safety"],
    ["🎛️", "Sensitivity", "WACC × Growth rate scenario matrix"],
  ] as const;

  return (
    <div className="mt-6">
      <h2
        className="m-0 max-w-[42rem] font-[family-name:var(--font-display)] text-[length:var(--text-page-title)] font-semibold leading-[1.08] tracking-[-0.045em]"
      >
        Stock Screener &amp; <em className="not-italic text-[var(--gold)]">DCF Analyzer</em>
      </h2>
      <p className="mt-3 text-[length:var(--text-lg)] text-[var(--text-secondary)]">
        Escribe un ticker en la barra lateral y pulsa <strong>Analyze →</strong>
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([icon, title, desc]) => (
          <Card key={title}>
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 font-semibold text-[var(--text-primary)]">{title}</div>
            <div className="mt-1 text-[length:var(--text-sm)] text-[var(--text-secondary)]">
              {desc}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-1.5 flex items-center justify-between text-[length:var(--text-md)] text-[var(--text-secondary)]">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--gold)]"
      />
    </label>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cj-input cj-input--num"
      />
      {suffix && (
        <span className="text-[length:var(--text-sm)] text-[var(--text-muted)]">{suffix}</span>
      )}
    </div>
  );
}

function FilterField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">{label}</span>
      <input
        type="number"
        value={value}
        step={0.5}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cj-input cj-input--num w-24"
      />
    </div>
  );
}
