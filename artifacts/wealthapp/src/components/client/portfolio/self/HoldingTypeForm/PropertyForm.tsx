import { useState } from "react";
import { Field, TextInput, AmountWithCurrency, DateInput, SubmitButton, ExpectedReturnField } from "./_shared";
import { formatCurrency } from "@/lib/currencyUtils";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

const COUNTRIES = ["UK", "France", "Ireland", "Germany", "Vietnam", "Singapore", "Australia", "Canada", "US", "Hong Kong", "UAE", "Other"];

export default function PropertyForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchasePrice ?? "");
  const [currentValue, setCurrentValue] = useState(initial?.currentEstimatedValue ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [mortgage, setMortgage] = useState(initial?.outstandingMortgage ?? "");
  const [rental, setRental] = useState(initial?.monthlyRentalIncome ?? "");
  const [address, setAddress] = useState(initial?.propertyAddress ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [expectedReturn, setExpectedReturn] = useState(initial?.expectedAnnualReturnPct ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const equity = (parseFloat(currentValue) || 0) - (parseFloat(mortgage) || 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Name is required.";
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) e.purchasePrice = "Purchase price is required.";
    if (!currentValue || parseFloat(currentValue) <= 0) e.currentValue = "Current value is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit({
        holdingType: "property", label, purchasePrice: parseFloat(purchasePrice), currentEstimatedValue: parseFloat(currentValue), currency, outstandingMortgage: parseFloat(mortgage) || 0, monthlyRentalIncome: parseFloat(rental) || 0, propertyAddress: address || null, country: country || null, purchaseDate: purchaseDate || null,
        expectedAnnualReturnPct: expectedReturn ? parseFloat(expectedReturn) : null,
      });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field label="Property name / label" required error={errors.label}>
        <TextInput value={label} onChange={setLabel} placeholder="e.g. Hanoi apartment, Paris studio" />
      </Field>
      <Field label="Purchase price" required error={errors.purchasePrice}>
        <AmountWithCurrency amount={purchasePrice} onAmountChange={setPurchasePrice} currency={currency} onCurrencyChange={setCurrency} />
      </Field>
      <Field label="Current estimated value" required error={errors.currentValue}>
        <AmountWithCurrency amount={currentValue} onAmountChange={setCurrentValue} currency={currency} onCurrencyChange={setCurrency} />
        <p className="text-xs text-slate-400">Your best estimate of what it would sell for today.</p>
        <p className="text-xs text-slate-400">Enter the current USD-equivalent value. We don't yet convert other currencies automatically.</p>
      </Field>
      <Field label="Outstanding mortgage">
        <AmountWithCurrency amount={mortgage} onAmountChange={setMortgage} currency={currency} onCurrencyChange={setCurrency} />
        <p className="text-xs text-slate-400">Leave blank if property is fully owned.</p>
        {(parseFloat(currentValue) > 0 || parseFloat(mortgage) > 0) && (
          <p className="text-xs text-slate-500 mt-1">Net equity: {formatCurrency(equity, currency)}</p>
        )}
      </Field>
      <Field label="Monthly rental income">
        <AmountWithCurrency amount={rental} onAmountChange={setRental} currency={currency} onCurrencyChange={setCurrency} />
      </Field>
      <Field label="Property address">
        <TextInput value={address} onChange={setAddress} placeholder="e.g. 12 Nguyen Hue, District 1" />
      </Field>
      <Field label="Country">
        <select value={country} onChange={e => setCountry(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] bg-white focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30">
          <option value="">Select country…</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Purchase date">
        <DateInput value={purchaseDate} onChange={setPurchaseDate} />
      </Field>
      <ExpectedReturnField value={expectedReturn} onChange={setExpectedReturn} holdingType="property" />
      <SubmitButton label={submitLabel} disabled={!label || !purchasePrice || !currentValue} loading={loading} onClick={handleSubmit} />
    </div>
  );
}
