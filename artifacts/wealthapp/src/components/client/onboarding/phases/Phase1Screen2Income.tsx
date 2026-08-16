const INCOME_TYPES = ["Salary", "Business", "Freelance", "Rental income", "Investment returns", "Other"];

const CURRENCIES = ["USD", "VND", "EUR"] as const;

export interface Screen2Data {
  monthlyIncome: number;
  incomeCurrency: "USD" | "VND" | "EUR";
  incomeType: string[];
  isStableIncome: boolean;
}

interface Props {
  data: Screen2Data;
  preferredCurrency: "USD" | "VND" | "EUR";
  onChange: (updates: Partial<Screen2Data>) => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-[#042C53]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-[#1D9E75]" : "bg-slate-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function Phase1Screen2Income({ data, preferredCurrency, onChange }: Props) {
  const activeCurrency = data.incomeCurrency || preferredCurrency;

  function toggleType(type: string) {
    const next = data.incomeType.includes(type)
      ? data.incomeType.filter(t => t !== type)
      : [...data.incomeType, type];
    onChange({ incomeType: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Your income</h1>
        <p className="text-sm text-slate-500">We use this to calculate your savings rate and track your budget.</p>
      </div>

      {/* Monthly income */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#042C53]">Monthly take-home income (after tax)</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min={0}
              value={data.monthlyIncome || ""}
              onChange={e => onChange({ monthlyIncome: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] transition-colors"
            />
          </div>
          <select
            value={activeCurrency}
            onChange={e => onChange({ incomeCurrency: e.target.value as typeof activeCurrency })}
            className="px-3 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] bg-white"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Income type */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#042C53]">How do you earn this? <span className="text-slate-400 font-normal">(select all that apply)</span></label>
        <div className="flex flex-wrap gap-2">
          {INCOME_TYPES.map(type => {
            const active = data.incomeType.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  active
                    ? "border-[#1D9E75] bg-[#1D9E75] text-white"
                    : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/40"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stable income toggle */}
      <div className="space-y-2">
        <Toggle
          checked={data.isStableIncome}
          onChange={v => onChange({ isStableIncome: v })}
          label="Is your income stable month to month?"
        />
        {!data.isStableIncome && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Variable income? We'll help you plan around this.
          </p>
        )}
      </div>
    </div>
  );
}
