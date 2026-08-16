import { useState } from "react";
import { Field, TextInput, AmountWithCurrency, SubmitButton } from "./_shared";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

const COUNTRIES = ["UK", "France", "Ireland", "Germany", "Vietnam", "Singapore", "Australia", "Canada", "US", "Hong Kong", "UAE", "Other"];

export default function PensionForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [schemeName, setSchemeName] = useState(initial?.schemeName ?? "");
  const [balance, setBalance] = useState(initial?.currentBalancePension ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [country, setCountry] = useState(initial?.pensionCountry ?? "");
  const [monthly, setMonthly] = useState(initial?.monthlyContribution ?? "");
  const [employer, setEmployer] = useState(initial?.employerContribution ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Name is required.";
    if (!schemeName.trim()) e.scheme = "Scheme name is required.";
    if (!balance || parseFloat(balance) <= 0) e.balance = "Balance is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit({ holdingType: "pension", label, schemeName, currentBalancePension: parseFloat(balance), currency, pensionCountry: country || null, monthlyContribution: monthly ? parseFloat(monthly) : 0, employerContribution: employer ? parseFloat(employer) : 0 });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field label="Label" required error={errors.label}>
        <TextInput value={label} onChange={setLabel} placeholder="e.g. UK workplace pension, CPF" />
      </Field>
      <Field label="Scheme / fund name" required error={errors.scheme}>
        <TextInput value={schemeName} onChange={setSchemeName} placeholder="e.g. Nest, Aviva, CPF OA" />
      </Field>
      <Field label="Current balance" required error={errors.balance}>
        <AmountWithCurrency amount={balance} onAmountChange={setBalance} currency={currency} onCurrencyChange={setCurrency} />
      </Field>
      <Field label="Country">
        <select value={country} onChange={e => setCountry(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] bg-white focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30">
          <option value="">Select country…</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Your monthly contribution">
        <AmountWithCurrency amount={monthly} onAmountChange={setMonthly} currency={currency} onCurrencyChange={setCurrency} />
      </Field>
      <Field label="Employer monthly contribution">
        <AmountWithCurrency amount={employer} onAmountChange={setEmployer} currency={currency} onCurrencyChange={setCurrency} />
      </Field>
      <SubmitButton label={submitLabel} disabled={!label || !schemeName || !balance} loading={loading} onClick={handleSubmit} />
    </div>
  );
}
