"use client";

import { useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { Badge, Card, Kpi, SectionLabel, fmtBillions, fmtPct, fmtX, fmtUsd } from "./ui";
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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] p-5">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-bold">📈 DCF Analyzer</h1>
        </div>

        <SectionLabel>Ticker</SectionLabel>
        <input
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          placeholder="AAPL, MSFT, ADBE…"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--series-1)]"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="mt-2 w-full rounded-md bg-[var(--series-1)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Fetching…" : "Analyze →"}
        </button>

        <hr className="my-5 border-[var(--border)]" />

        <SectionLabel>DCF Parameters</SectionLabel>
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

        <hr className="my-5 border-[var(--border)]" />

        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="mb-2 flex w-full items-center justify-between text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]"
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
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        <div className="mb-4 flex justify-end">
          <LogoutButton />
        </div>

        {error && (
          <Card className="mb-4 border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10">
            <p className="text-sm text-[var(--status-critical)]">{error}</p>
          </Card>
        )}

        {!data && !loading && !error && <Landing />}

        {data && passResult && (
          <>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-2xl font-bold">{data.row.ticker}</h2>
              <Badge status={passResult.passed ? "pass" : "fail"} />
            </div>
            <div className="mb-6 font-mono text-sm text-[var(--text-secondary)]">
              {data.row.name} · {data.row.sector}
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Price" value={fmtUsd(data.row.price)} />
              <Kpi label="Market Cap" value={fmtBillions(data.row.marketCap)} />
              <Kpi label="P/E Ratio" value={fmtX(data.row.peRatio)} />
              <Kpi label="P/B Ratio" value={fmtX(data.row.pbRatio)} />
              <Kpi label="ROE" value={fmtPct(data.row.roe)} />
              <Kpi label="Profit Margin" value={fmtPct(data.row.profitMargin)} />
            </div>

            <div className="mb-5 flex gap-1 border-b border-[var(--border)]">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === t
                      ? "border-b-2 border-[var(--series-1)] text-[var(--series-1)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
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
    <div className="mt-10">
      <h2 className="text-3xl font-bold">Stock Screener &amp; DCF Analyzer</h2>
      <p className="mt-2 text-[var(--text-secondary)]">
        Enter a ticker in the sidebar and click <strong>Analyze →</strong>
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([icon, title, desc]) => (
          <Card key={title}>
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 font-semibold">{title}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{desc}</div>
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
    <label className="mb-1.5 flex items-center justify-between text-sm text-[var(--text-secondary)]">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--series-1)]"
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
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs outline-none disabled:opacity-40"
      />
      {suffix && <span className="text-xs text-[var(--text-muted)]">{suffix}</span>}
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
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <input
        type="number"
        value={value}
        step={0.5}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-right font-mono text-xs outline-none"
      />
    </div>
  );
}
