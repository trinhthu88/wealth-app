import { useState } from "react";
import { Field, TextInput, NumberInput, AmountWithCurrency, SubmitButton } from "./_shared";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function CashForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [balance, setBalance] = useState(initial?.currentBalance ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [accountType, setAccountType] = useState(initial?.accountType ?? "");
  const [rate, setRate] = useState(initial?.interestRatePct ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Name is required.";
    if (!bankName.trim()) e.bank = "Bank name is required.";
    if (!balance || parseFloat(balance) <= 0) e.balance = "Balance is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit({ holdingType: "cash", label, bankName, currentBalance: parseFloat(balance), currency, accountType: accountType || null, interestRatePct: rate ? parseFloat(rate) : null });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field label="Account label" required error={errors.label}>
        <TextInput value={label} onChange={setLabel} placeholder="e.g. Techcombank savings, Emergency fund" />
      </Field>
      <Field label="Bank / institution" required error={errors.bank}>
        <TextInput value={bankName} onChange={setBankName} placeholder="e.g. Techcombank, HSBC" />
      </Field>
      <Field label="Current balance" required error={errors.balance}>
        <AmountWithCurrency amount={balance} onAmountChange={setBalance} currency={currency} onCurrencyChange={setCurrency} />
      </Field>
      <Field label="Account type">
        <TextInput value={accountType} onChange={setAccountType} placeholder="e.g. Savings, Fixed deposit, Current" />
      </Field>
      <Field label="Annual interest rate (%)">
        <NumberInput value={rate} onChange={setRate} placeholder="e.g. 4.5" step="0.01" />
        <p className="text-xs text-slate-400">Annual interest rate, if known.</p>
      </Field>
      <SubmitButton label={submitLabel} disabled={!label || !bankName || !balance} loading={loading} onClick={handleSubmit} />
    </div>
  );
}
