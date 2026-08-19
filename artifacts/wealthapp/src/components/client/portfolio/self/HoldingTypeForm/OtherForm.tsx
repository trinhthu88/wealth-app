import { useState } from "react";
import { Field, TextInput, AmountWithCurrency, DateInput, TextareaInput, SubmitButton, ExpectedReturnField } from "./_shared";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function OtherForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [currentValue, setCurrentValue] = useState(initial?.currentValueOther ?? "");
  const [costBasis, setCostBasis] = useState(initial?.totalInvestedOther ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [expectedReturn, setExpectedReturn] = useState(initial?.expectedAnnualReturnPct ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Label is required.";
    if (!currentValue || parseFloat(currentValue) <= 0) e.value = "Current value is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await onSubmit({
        holdingType: "other", label, currentValueOther: parseFloat(currentValue), totalInvestedOther: costBasis ? parseFloat(costBasis) : null, currency, purchaseDate: purchaseDate || null, notes: notes || null,
        expectedAnnualReturnPct: expectedReturn ? parseFloat(expectedReturn) : null,
      });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field label="Label" required error={errors.label}>
        <TextInput value={label} onChange={setLabel} placeholder="e.g. Angel investment, Art collection, Business stake" />
      </Field>
      <Field label="Current estimated value" required error={errors.value}>
        <AmountWithCurrency amount={currentValue} onAmountChange={setCurrentValue} currency={currency} onCurrencyChange={setCurrency} />
        <p className="text-xs text-slate-400">Enter the current USD-equivalent value. We don't yet convert other currencies automatically.</p>
      </Field>
      <Field label="Original amount invested (cost basis)">
        <AmountWithCurrency amount={costBasis} onAmountChange={setCostBasis} currency={currency} onCurrencyChange={setCurrency} />
        <p className="text-xs text-slate-400">How much did you put in? Leave blank if unknown.</p>
      </Field>
      <Field label="Purchase / investment date">
        <DateInput value={purchaseDate} onChange={setPurchaseDate} />
      </Field>
      <Field label="Notes">
        <TextareaInput value={notes} onChange={setNotes} placeholder="Any notes about this investment…" rows={2} />
      </Field>
      <ExpectedReturnField value={expectedReturn} onChange={setExpectedReturn} holdingType="other" />
      <SubmitButton label={submitLabel} disabled={!label || !currentValue} loading={loading} onClick={handleSubmit} />
    </div>
  );
}
