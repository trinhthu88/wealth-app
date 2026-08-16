import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";

const LIABILITY_CATEGORIES = [
  { value: "mortgage",         label: "🏠 Mortgage",       placeholder: "e.g. Home loan — VietinBank" },
  { value: "personal_loan",    label: "💳 Personal loan",  placeholder: "e.g. Car loan" },
  { value: "credit_card",      label: "💳 Credit card",    placeholder: "e.g. Techcombank Visa" },
  { value: "business_debt",    label: "💼 Business debt",  placeholder: "e.g. Business overdraft" },
  { value: "other_liability",  label: "··· Other",          placeholder: "e.g. Family loan" },
];

const CURRENCIES = ["USD", "VND", "EUR"] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string; category: string; balanceUsd: number; currencyOriginal: string;
    interestRatePercent?: number | null; monthlyPaymentUsd?: number | null;
  }) => Promise<void>;
}

export default function AddLiabilitySheet({ isOpen, onClose, onSave }: Props) {
  const [category, setCategory] = useState("mortgage");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const catInfo = LIABILITY_CATEGORIES.find(c => c.value === category);
  const numBalance = parseFloat(balance) || 0;
  const numPayment = parseFloat(monthlyPayment) || 0;
  const numRate = parseFloat(interestRate) || 0;

  function reset() {
    setCategory("mortgage");
    setName("");
    setBalance("");
    setCurrency("USD");
    setMonthlyPayment("");
    setInterestRate("");
    setError("");
  }

  async function handleSave() {
    if (!name.trim() || numBalance <= 0) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: name.trim(),
        category,
        balanceUsd: numBalance,
        currencyOriginal: currency,
        interestRatePercent: numRate > 0 ? numRate : null,
        monthlyPaymentUsd: numPayment > 0 ? numPayment : null,
      });
      reset();
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Add a liability">
      <div className="space-y-5 pb-4">
        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#042C53]">Category *</label>
          <div className="flex flex-wrap gap-2">
            {LIABILITY_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm border transition-all",
                  category === cat.value
                    ? "border-red-400 bg-red-50 text-red-600 font-medium"
                    : "border-slate-200 text-slate-600 hover:border-red-300"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Label *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={catInfo?.placeholder ?? "Describe this liability"}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
          />
        </div>

        {/* Balance */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Outstanding balance *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0"
              min={0}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="inline-flex items-center bg-slate-100 rounded-xl p-0.5">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                    currency === c ? "bg-white text-[#042C53] shadow-sm" : "text-slate-500"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly payment (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">
            Monthly payment <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            value={monthlyPayment}
            onChange={e => setMonthlyPayment(e.target.value)}
            placeholder="0"
            min={0}
            style={{ MozAppearance: "textfield" } as React.CSSProperties}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Interest rate (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">
            Annual interest rate % <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            value={interestRate}
            onChange={e => setInterestRate(e.target.value)}
            placeholder="e.g. 5.5"
            min={0}
            max={50}
            step={0.1}
            style={{ MozAppearance: "textfield" } as React.CSSProperties}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!name.trim() || numBalance <= 0 || saving}
          className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Add liability"}
        </button>
      </div>
    </BottomSheet>
  );
}
