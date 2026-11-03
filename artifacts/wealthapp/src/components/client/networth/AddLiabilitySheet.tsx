import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { Home, Wallet, CreditCard, Briefcase, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const LIABILITY_CATEGORIES = [
  { value: "mortgage",         icon: Home, label: "Mortgage",       placeholder: "e.g. Home loan — VietinBank" },
  { value: "personal_loan",    icon: Wallet, label: "Personal loan",  placeholder: "e.g. Car loan" },
  { value: "credit_card",      icon: CreditCard, label: "Credit card",    placeholder: "e.g. Techcombank Visa" },
  { value: "business_debt",    icon: Briefcase, label: "Business debt",  placeholder: "e.g. Business overdraft" },
  { value: "other_liability",  icon: MoreHorizontal, label: "Other",          placeholder: "e.g. Family loan" },
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
          <label className="text-[13px] font-medium text-forest">Category *</label>
          <div className="flex flex-wrap gap-2">
            {LIABILITY_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "h-10 px-3.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5",
                  category === cat.value
                    ? "bg-forest text-paper"
                    : "bg-surface text-forest hover:bg-breeze"
                )}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-forest">Label *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={catInfo?.placeholder ?? "Describe this liability"}
            className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
        </div>

        {/* Balance */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-forest">Outstanding balance *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0"
              min={0}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="flex-1 min-w-0 h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-forest/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="inline-flex items-center bg-surface rounded-full p-1 shrink-0">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "h-10 px-3 rounded-full text-[12px] font-semibold transition-all",
                    currency === c ? "bg-forest text-paper" : "text-ink-40 hover:text-forest"
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
          <label className="text-[13px] font-medium text-forest">
            Monthly payment <span className="text-ink-40 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            value={monthlyPayment}
            onChange={e => setMonthlyPayment(e.target.value)}
            placeholder="0"
            min={0}
            style={{ MozAppearance: "textfield" } as React.CSSProperties}
            className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-forest/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Interest rate (optional) */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-forest">
            Annual interest rate % <span className="text-ink-40 font-normal">(optional)</span>
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
            className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-forest/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {error && <p className="text-[13px] font-medium text-clay-ink">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!name.trim() || numBalance <= 0 || saving}
          className="w-full h-12 px-5 rounded-full bg-forest text-paper font-semibold text-[14px] hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Add liability"}
        </button>
      </div>
    </BottomSheet>
  );
}
