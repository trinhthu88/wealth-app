import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Field, TextInput, NumberInput, AmountWithCurrency, DateInput, SubmitButton, SymbolSearchInput } from "./_shared";
import type { SymbolSearchType } from "./_shared";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  holdingType: string;
  symbolType: SymbolSearchType;
  tickerLabel: string;
  tickerPlaceholder: string;
  platformLabel?: string;
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function TickerHoldingForm({
  holdingType, symbolType, tickerLabel, tickerPlaceholder, platformLabel,
  initial, onSubmit, submitLabel,
}: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [ticker, setTicker] = useState(initial?.ticker ?? "");
  const [broker, setBroker] = useState(initial?.brokerPlatform ?? "");
  const [units, setUnits] = useState(initial?.unitsHeld ?? "");
  const [avgCost, setAvgCost] = useState(initial?.averageCostPrice ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [pricePreview, setPricePreview] = useState<{ price: number; change: number } | null>(null);
  const [priceFetching, setPriceFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function fetchPrice(sym: string) {
    if (!sym) return;
    setPriceFetching(true);
    setPricePreview(null);
    try {
      const r = await apiFetch<{ price_usd: number; change_1d_pct: number }>(`/prices/stock/${encodeURIComponent(sym)}`);
      setPricePreview({ price: r.price_usd, change: r.change_1d_pct });
    } catch {
      setPricePreview(null);
    } finally {
      setPriceFetching(false);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Name is required.";
    if (!ticker.trim()) e.ticker = `${tickerLabel} is required.`;
    if (!units || parseFloat(units) <= 0) e.units = "Units must be greater than 0.";
    if (!avgCost || parseFloat(avgCost) <= 0) e.avgCost = "Cost price is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit({
        holdingType, label, ticker, brokerPlatform: broker || null,
        unitsHeld: parseFloat(units), averageCostPrice: parseFloat(avgCost),
        currency, purchaseDate: purchaseDate || null,
      });
    } finally { setLoading(false); }
  }

  const currentValue = pricePreview && parseFloat(units) > 0
    ? pricePreview.price * parseFloat(units)
    : null;

  return (
    <div className="space-y-4">
      <Field label="What do you call this holding?" required error={errors.label}>
        <TextInput value={label} onChange={setLabel} placeholder="e.g. My portfolio, Retirement fund" />
      </Field>

      <Field label={tickerLabel} required error={errors.ticker}>
        <SymbolSearchInput
          value={ticker}
          onChange={v => { setTicker(v); setPricePreview(null); }}
          onSelect={sym => fetchPrice(sym)}
          symbolType={symbolType}
          placeholder={tickerPlaceholder}
        />
        {priceFetching && (
          <p className="text-xs text-slate-400 mt-1 animate-pulse">Fetching live price…</p>
        )}
        {pricePreview && (
          <div className="mt-1.5 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-[#042C53]">${pricePreview.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
            <span className={`text-xs font-medium ${pricePreview.change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {pricePreview.change >= 0 ? "▲" : "▼"} {Math.abs(pricePreview.change).toFixed(2)}%
            </span>
            {currentValue !== null && (
              <span className="text-xs text-slate-500 ml-auto">Est. value: ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            )}
          </div>
        )}
      </Field>

      <Field label="Units held" required error={errors.units}>
        <NumberInput
          value={units}
          onChange={v => { setUnits(v); }}
          step="0.000001"
          placeholder="e.g. 10.5"
        />
      </Field>

      <Field label="Average cost price per unit" required error={errors.avgCost}>
        <AmountWithCurrency amount={avgCost} onAmountChange={setAvgCost} currency={currency} onCurrencyChange={setCurrency} />
        <p className="text-xs text-slate-400">The average price you paid per unit.</p>
      </Field>

      {platformLabel !== undefined && (
        <Field label={platformLabel || "Platform / broker"}>
          <TextInput value={broker} onChange={setBroker} placeholder="e.g. Interactive Brokers, Fidelity" />
        </Field>
      )}

      <Field label="Purchase date">
        <DateInput value={purchaseDate} onChange={setPurchaseDate} />
      </Field>

      <SubmitButton label={submitLabel} disabled={!label || !ticker || !units || !avgCost} loading={loading} onClick={handleSubmit} />
    </div>
  );
}
