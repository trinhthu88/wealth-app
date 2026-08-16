import { useState } from "react";
import { Loader2 } from "lucide-react";
import { getHoldingTypeConfig } from "@/lib/holdingTypeConfig";

const CURRENCIES = ["USD", "VND", "EUR"] as const;

export interface NewHolding {
  holdingType: string;
  label: string;
  currency: string;
  ticker?: string;
  brokerPlatform?: string;
  unitsHeld?: number;
  averageCostPrice?: number;
  coinSymbol?: string;
  exchangeName?: string;
  propertyAddress?: string;
  purchasePrice?: number;
  currentEstimatedValue?: number;
  outstandingMortgage?: number;
  bankName?: string;
  accountType?: string;
  currentBalance?: number;
  schemeName?: string;
  pensionCountry?: string;
  currentBalancePension?: number;
  monthlyContribution?: number;
  currentValueOther?: number;
  totalInvestedOther?: number;
}

interface HoldingMiniFormProps {
  holdingType: string;
  defaultCurrency: string;
  onAdd: (holding: NewHolding) => Promise<void>;
  onCancel: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, uppercase }: { value: string; onChange: (v: string) => void; placeholder?: string; uppercase?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
    />
  );
}

function NumberWithCurrency({ value, onChange, currency, onCurrencyChange, placeholder, step }: {
  value: string; onChange: (v: string) => void;
  currency: string; onCurrencyChange: (v: string) => void;
  placeholder?: string; step?: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        step={step ?? "any"}
        min={0}
        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
      />
      <select
        value={currency}
        onChange={e => onCurrencyChange(e.target.value)}
        className="px-2 py-2 rounded-lg border border-slate-200 text-sm text-[#042C53] bg-white focus:outline-none"
      >
        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

export default function HoldingMiniForm({ holdingType, defaultCurrency, onAdd, onCancel }: HoldingMiniFormProps) {
  const [label, setLabel] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // type-specific fields
  const [ticker, setTicker] = useState("");
  const [broker, setBroker] = useState("");
  const [units, setUnits] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [coinSymbol, setCoinSymbol] = useState("");
  const [exchange, setExchange] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [mortgage, setMortgage] = useState("");
  const [bankName, setBankName] = useState("");
  const [balance, setBalance] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [pensionBalance, setPensionBalance] = useState("");
  const [otherCurrentValue, setOtherCurrentValue] = useState("");
  const [otherCostBasis, setOtherCostBasis] = useState("");

  const config = getHoldingTypeConfig(holdingType);

  function validate(): string {
    if (!label.trim()) return "Give this holding a name.";
    if (holdingType === "stock_etf") {
      if (!ticker.trim()) return "Ticker symbol is required.";
      if (!units || parseFloat(units) <= 0) return "Units held must be greater than 0.";
    }
    if (holdingType === "crypto") {
      if (!coinSymbol.trim()) return "Coin symbol is required.";
      if (!units || parseFloat(units) <= 0) return "Units held must be greater than 0.";
    }
    if (holdingType === "property") {
      if (!purchasePrice || parseFloat(purchasePrice) <= 0) return "Purchase price is required.";
      if (!currentValue || parseFloat(currentValue) <= 0) return "Current value is required.";
    }
    if (holdingType === "cash") {
      if (!bankName.trim()) return "Bank name is required.";
      if (!balance || parseFloat(balance) <= 0) return "Balance is required.";
    }
    if (holdingType === "pension") {
      if (!schemeName.trim()) return "Scheme name is required.";
      if (!pensionBalance || parseFloat(pensionBalance) <= 0) return "Balance is required.";
    }
    if (holdingType === "other") {
      if (!otherCurrentValue || parseFloat(otherCurrentValue) <= 0) return "Current value is required.";
    }
    return "";
  }

  async function handleAdd() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setSaving(true);

    const holding: NewHolding = {
      holdingType, label: label.trim(), currency,
      ...(holdingType === "stock_etf" && {
        ticker: ticker.trim(), brokerPlatform: broker.trim() || undefined,
        unitsHeld: parseFloat(units), averageCostPrice: avgCost ? parseFloat(avgCost) : undefined,
      }),
      ...(holdingType === "crypto" && {
        coinSymbol: coinSymbol.trim(), exchangeName: exchange.trim() || undefined,
        unitsHeld: parseFloat(units), averageCostPrice: avgCost ? parseFloat(avgCost) : undefined,
      }),
      ...(holdingType === "property" && {
        purchasePrice: parseFloat(purchasePrice), currentEstimatedValue: parseFloat(currentValue),
        outstandingMortgage: mortgage ? parseFloat(mortgage) : 0,
      }),
      ...(holdingType === "cash" && {
        bankName: bankName.trim(), currentBalance: parseFloat(balance),
      }),
      ...(holdingType === "pension" && {
        schemeName: schemeName.trim(), currentBalancePension: parseFloat(pensionBalance),
      }),
      ...(holdingType === "other" && {
        currentValueOther: parseFloat(otherCurrentValue),
        totalInvestedOther: otherCostBasis ? parseFloat(otherCostBasis) : undefined,
      }),
    };

    try {
      await onAdd(holding);
    } catch (e: any) {
      setError(e?.message ?? "Failed to add holding");
      setSaving(false);
    }
  }

  return (
    <div className="border border-[#1D9E75]/30 rounded-xl p-4 bg-[#1D9E75]/3 space-y-3">
      <p className="text-xs font-semibold text-[#1D9E75] uppercase tracking-wide">{config.label}</p>

      <Field label="What do you call this?">
        <TextInput value={label} onChange={setLabel} placeholder="e.g. My ISA, Bitcoin, Hanoi apartment" />
      </Field>

      {holdingType === "stock_etf" && (<>
        <Field label="Ticker symbol">
          <TextInput value={ticker} onChange={setTicker} placeholder="e.g. IVV, AAPL" uppercase />
        </Field>
        <Field label="Broker / platform">
          <TextInput value={broker} onChange={setBroker} placeholder="e.g. Interactive Brokers" />
        </Field>
        <Field label="Units held">
          <input type="number" value={units} onChange={e => setUnits(e.target.value)} placeholder="0" min={0} step="any"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]" />
        </Field>
        <Field label="Average cost price per unit">
          <NumberWithCurrency value={avgCost} onChange={setAvgCost} currency={currency} onCurrencyChange={setCurrency} placeholder="0.00" />
        </Field>
      </>)}

      {holdingType === "crypto" && (<>
        <Field label="Coin symbol">
          <TextInput value={coinSymbol} onChange={setCoinSymbol} placeholder="e.g. BTC, ETH" uppercase />
        </Field>
        <Field label="Exchange">
          <TextInput value={exchange} onChange={setExchange} placeholder="e.g. Binance, Coinbase" />
        </Field>
        <Field label="Units held">
          <input type="number" value={units} onChange={e => setUnits(e.target.value)} placeholder="0" min={0} step="0.00000001"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]" />
        </Field>
        <Field label="Average cost price">
          <NumberWithCurrency value={avgCost} onChange={setAvgCost} currency={currency} onCurrencyChange={setCurrency} />
        </Field>
      </>)}

      {holdingType === "property" && (<>
        <Field label="Purchase price">
          <NumberWithCurrency value={purchasePrice} onChange={setPurchasePrice} currency={currency} onCurrencyChange={setCurrency} />
        </Field>
        <Field label="Current estimated value">
          <NumberWithCurrency value={currentValue} onChange={setCurrentValue} currency={currency} onCurrencyChange={v => setCurrency(v)} />
        </Field>
        <Field label="Outstanding mortgage (optional)">
          <NumberWithCurrency value={mortgage} onChange={setMortgage} currency={currency} onCurrencyChange={v => setCurrency(v)} placeholder="0" />
        </Field>
      </>)}

      {holdingType === "cash" && (<>
        <Field label="Bank name">
          <TextInput value={bankName} onChange={setBankName} placeholder="e.g. Techcombank, HSBC" />
        </Field>
        <Field label="Current balance">
          <NumberWithCurrency value={balance} onChange={setBalance} currency={currency} onCurrencyChange={setCurrency} />
        </Field>
      </>)}

      {holdingType === "pension" && (<>
        <Field label="Scheme name">
          <TextInput value={schemeName} onChange={setSchemeName} placeholder="e.g. UK workplace pension" />
        </Field>
        <Field label="Current balance">
          <NumberWithCurrency value={pensionBalance} onChange={setPensionBalance} currency={currency} onCurrencyChange={setCurrency} />
        </Field>
      </>)}

      {holdingType === "other" && (<>
        <Field label="Current value">
          <NumberWithCurrency value={otherCurrentValue} onChange={setOtherCurrentValue} currency={currency} onCurrencyChange={setCurrency} />
        </Field>
        <Field label="Total invested (cost basis, optional)">
          <NumberWithCurrency value={otherCostBasis} onChange={setOtherCostBasis} currency={currency} onCurrencyChange={v => setCurrency(v)} placeholder="0" />
        </Field>
      </>)}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-60"
        >
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</> : "Add holding"}
        </button>
      </div>
    </div>
  );
}
