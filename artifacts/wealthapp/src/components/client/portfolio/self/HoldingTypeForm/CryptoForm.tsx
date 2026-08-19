import { useState } from "react";
import { Field, TextInput, NumberInput, AmountWithCurrency, DateInput, SubmitButton, SymbolSearchInput, ExpectedReturnField } from "./_shared";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function CryptoForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [coin, setCoin] = useState(initial?.coinSymbol ?? "");
  const [units, setUnits] = useState(initial?.unitsHeld ?? "");
  const [avgCost, setAvgCost] = useState(initial?.averageCostPrice ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [exchange, setExchange] = useState(initial?.exchangeName ?? "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [expectedReturn, setExpectedReturn] = useState(initial?.expectedAnnualReturnPct ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Name is required.";
    if (!coin.trim()) e.coin = "Coin symbol is required.";
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
        holdingType: "crypto", label, coinSymbol: coin, unitsHeld: parseFloat(units), averageCostPrice: parseFloat(avgCost), currency, exchangeName: exchange || null, purchaseDate: purchaseDate || null,
        expectedAnnualReturnPct: expectedReturn ? parseFloat(expectedReturn) : null,
      });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field label="What do you call this?" required error={errors.label}>
        <TextInput value={label} onChange={setLabel} placeholder="e.g. Bitcoin, My ETH stack" />
      </Field>
      <Field label="Coin symbol" required error={errors.coin}>
        <SymbolSearchInput
          value={coin}
          onChange={setCoin}
          symbolType="crypto"
          placeholder="Search crypto, e.g. Bitcoin, ETH"
        />
      </Field>
      <Field label="Units held" required error={errors.units}>
        <NumberInput value={units} onChange={setUnits} step="0.00000001" />
      </Field>
      <Field label="Average cost price" required error={errors.avgCost}>
        <AmountWithCurrency amount={avgCost} onAmountChange={setAvgCost} currency={currency} onCurrencyChange={setCurrency} />
      </Field>
      <Field label="Exchange / wallet">
        <TextInput value={exchange} onChange={setExchange} placeholder="e.g. Binance, Coinbase, Ledger" />
      </Field>
      <Field label="Purchase date">
        <DateInput value={purchaseDate} onChange={setPurchaseDate} />
      </Field>
      <ExpectedReturnField value={expectedReturn} onChange={setExpectedReturn} holdingType="crypto" coinSymbol={coin} />
      <SubmitButton label={submitLabel} disabled={!label || !coin || !units || !avgCost} loading={loading} onClick={handleSubmit} />
    </div>
  );
}
