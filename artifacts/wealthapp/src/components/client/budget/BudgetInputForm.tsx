import InvestmentContributionRow from "./InvestmentContributionRow";
import type { InvestmentContribution } from "@/hooks/useClientBudget";
import { cn } from "@/lib/utils";

export interface BudgetFormState {
  primaryIncome: string;
  secondaryIncome: string;
  rentalIncome: string;
  otherIncome: string;
  housing: string;
  utilities: string;
  transport: string;
  insurance: string;
  foodDining: string;
  entertainment: string;
  shopping: string;
  health: string;
  education: string;
  otherExpenses: string;
  otherInvestments: string;
}

const EXPENSE_CATEGORIES = [
  { key: "housing",       icon: "🏠", label: "Housing (rent / mortgage)" },
  { key: "utilities",     icon: "⚡", label: "Utilities & bills"          },
  { key: "transport",     icon: "🚌", label: "Transport"                  },
  { key: "insurance",     icon: "🛡", label: "Insurance"                  },
  { key: "foodDining",    icon: "🍜", label: "Food & dining"              },
  { key: "entertainment", icon: "🎬", label: "Entertainment"              },
  { key: "shopping",      icon: "🛍", label: "Shopping"                   },
  { key: "health",        icon: "❤️", label: "Health"                     },
  { key: "education",     icon: "📚", label: "Education"                  },
  { key: "otherExpenses", icon: "···", label: "Other expenses"            },
] as const;

type ExpenseKey = typeof EXPENSE_CATEGORIES[number]["key"];

function n(s: string) { return parseFloat(s) || 0; }

function totalExpenses(form: BudgetFormState) {
  return EXPENSE_CATEGORIES.reduce((sum, cat) => sum + n(form[cat.key as ExpenseKey]), 0);
}
function totalIncome(form: BudgetFormState) {
  return n(form.primaryIncome) + n(form.secondaryIncome) + n(form.rentalIncome) + n(form.otherIncome);
}

interface Props {
  form: BudgetFormState;
  onChange: (field: keyof BudgetFormState, value: string) => void;
  syncedContributions: InvestmentContribution[];
  isReadOnly: boolean;
  saving: boolean;
  onSave: () => void;
  isCurrentMonth: boolean;
  onEditThisMonth: () => void;
}

function NumberInput({
  label, value, onChange, placeholder, readOnly,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        min={0}
        readOnly={readOnly}
        style={{ MozAppearance: "textfield" } as React.CSSProperties}
        className={cn(
          "w-full px-3 py-2 rounded-lg border text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          readOnly
            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-default"
            : "border-[#E2E8F0] bg-white"
        )}
      />
    </div>
  );
}

function SectionHeader({ title, total, totalColor = "text-slate-600" }: { title: string; total: number; totalColor?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-[#042C53]">{title}</h3>
      <span className={cn("text-sm font-semibold", totalColor)}>
        ${Math.round(total).toLocaleString()}
      </span>
    </div>
  );
}

export default function BudgetInputForm({
  form, onChange, syncedContributions, isReadOnly, saving, onSave, isCurrentMonth, onEditThisMonth,
}: Props) {
  const incomeTotal = totalIncome(form);
  const expenseTotal = totalExpenses(form);
  const otherInvest = n(form.otherInvestments);
  const syncedTotal = syncedContributions.reduce((s, c) => s + c.amount, 0);
  const investTotal = syncedTotal + otherInvest;

  return (
    <div className="space-y-6">
      {/* Read-only banner */}
      {isReadOnly && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <p className="text-sm text-slate-500">Viewing past month — read only</p>
          <button
            onClick={onEditThisMonth}
            className="text-sm text-[#1D9E75] font-medium hover:text-[#0F6E56]"
          >
            Edit this month
          </button>
        </div>
      )}

      {/* INCOME */}
      <div>
        <SectionHeader title="Income" total={incomeTotal} totalColor="text-[#1D9E75]" />
        <div className="space-y-3">
          <NumberInput label="Primary income (take-home, after tax)" value={form.primaryIncome} onChange={v => onChange("primaryIncome", v)} readOnly={isReadOnly} />
          <NumberInput label="Secondary income" value={form.secondaryIncome} onChange={v => onChange("secondaryIncome", v)} placeholder="Freelance, consulting…" readOnly={isReadOnly} />
          <NumberInput label="Rental income" value={form.rentalIncome} onChange={v => onChange("rentalIncome", v)} placeholder="From investment properties" readOnly={isReadOnly} />
          <NumberInput label="Other income" value={form.otherIncome} onChange={v => onChange("otherIncome", v)} placeholder="Dividends, bonuses…" readOnly={isReadOnly} />
        </div>
      </div>

      {/* EXPENSES */}
      <div>
        <SectionHeader title="Monthly expenses" total={expenseTotal} totalColor="text-red-500" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPENSE_CATEGORIES.map(cat => (
            <NumberInput
              key={cat.key}
              label={`${cat.icon} ${cat.label}`}
              value={form[cat.key as keyof BudgetFormState]}
              onChange={v => onChange(cat.key as keyof BudgetFormState, v)}
              readOnly={isReadOnly}
            />
          ))}
        </div>
      </div>

      {/* INVESTMENT CONTRIBUTIONS */}
      <div>
        <SectionHeader title="Investment contributions" total={investTotal} totalColor="text-[#1D9E75]" />
        <p className="text-xs text-slate-400 mb-3">Fixed monthly amounts going into your investments.</p>
        <div className="space-y-2">
          {syncedContributions.map(c => (
            <InvestmentContributionRow key={c.source_id} contribution={c} />
          ))}
          <NumberInput
            label="Other investment contributions"
            value={form.otherInvestments}
            onChange={v => onChange("otherInvestments", v)}
            placeholder="e.g. brokerage top-ups, crypto buys"
            readOnly={isReadOnly}
          />
        </div>
        {investTotal > 0 && (
          <p className="text-sm font-semibold text-[#1D9E75] mt-3">
            Total monthly investments: ${Math.round(investTotal).toLocaleString()}
          </p>
        )}
      </div>

      {/* SAVE */}
      {(!isReadOnly || isCurrentMonth) && (
        <button
          onClick={onSave}
          disabled={isReadOnly || saving}
          className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save budget"}
        </button>
      )}
    </div>
  );
}
