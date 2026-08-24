import {
  Home,
  Zap,
  Bus,
  Shield,
  Utensils,
  Film,
  ShoppingBag,
  HeartPulse,
  BookOpen,
  MoreHorizontal
} from "lucide-react";
import InvestmentContributionRow from "./InvestmentContributionRow";
import HoldingContributionPicker, { type HoldingContributionEntry } from "./HoldingContributionPicker";
import type { InvestmentContribution } from "@/hooks/useClientBudget";
import type { ClientHolding } from "@/hooks/useClientHoldings";
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
  { key: "housing",       icon: <Home className="w-4 h-4 text-forest mr-2" />, label: "Housing (rent / mortgage)" },
  { key: "utilities",     icon: <Zap className="w-4 h-4 text-forest mr-2" />, label: "Utilities & bills"          },
  { key: "transport",     icon: <Bus className="w-4 h-4 text-forest mr-2" />, label: "Transport"                  },
  { key: "insurance",     icon: <Shield className="w-4 h-4 text-forest mr-2" />, label: "Insurance"                  },
  { key: "foodDining",    icon: <Utensils className="w-4 h-4 text-forest mr-2" />, label: "Food & dining"              },
  { key: "entertainment", icon: <Film className="w-4 h-4 text-forest mr-2" />, label: "Entertainment"              },
  { key: "shopping",      icon: <ShoppingBag className="w-4 h-4 text-forest mr-2" />, label: "Shopping"                   },
  { key: "health",        icon: <HeartPulse className="w-4 h-4 text-forest mr-2" />, label: "Health"                     },
  { key: "education",     icon: <BookOpen className="w-4 h-4 text-forest mr-2" />, label: "Education"                  },
  { key: "otherExpenses", icon: <MoreHorizontal className="w-4 h-4 text-forest mr-2" />, label: "Other expenses"            },
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
  holdings: ClientHolding[];
  holdingContributions: HoldingContributionEntry[];
  onHoldingContributionsChange: (entries: HoldingContributionEntry[]) => void;
  isReadOnly: boolean;
  saving: boolean;
  onSave: () => void;
  isCurrentMonth: boolean;
  onEditThisMonth: () => void;
}

function NumberInput({
  label, value, onChange, placeholder, readOnly,
}: {
  label: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center text-xs font-medium text-ink-40">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        min={0}
        readOnly={readOnly}
        style={{ MozAppearance: "textfield" } as React.CSSProperties}
        className={cn(
          "w-full min-h-11 px-3 py-2 rounded-xl border text-sm text-forest focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          readOnly
            ? "bg-paper border-hairline text-ink-30 cursor-default"
            : "border-hairline bg-surface"
        )}
      />
    </div>
  );
}

function SectionHeader({ title, total, totalColor = "text-ink-60" }: { title: string; total: number; totalColor?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-base font-semibold text-forest">{title}</h3>
      <span className={cn("text-sm font-semibold", totalColor)}>
        ${Math.round(total).toLocaleString()}
      </span>
    </div>
  );
}

export default function BudgetInputForm({
  form, onChange, syncedContributions, holdings, holdingContributions, onHoldingContributionsChange,
  isReadOnly, saving, onSave, isCurrentMonth, onEditThisMonth,
}: Props) {
  const incomeTotal = totalIncome(form);
  const expenseTotal = totalExpenses(form);
  const otherInvest = n(form.otherInvestments);
  const syncedTotal = syncedContributions.reduce((s, c) => s + c.amount, 0);
  const holdingTotal = holdingContributions.reduce((s, e) => s + (n(e.amount)), 0);
  const investTotal = syncedTotal + holdingTotal + otherInvest;

  return (
    <div className="space-y-6">
      {/* Read-only banner */}
      {isReadOnly && (
        <div className="flex items-center justify-between bg-paper border border-hairline rounded-xl px-4 py-2.5">
          <p className="text-sm text-ink-40">Viewing past month — read only</p>
          <button
            onClick={onEditThisMonth}
            className="text-sm text-green font-semibold hover:text-forest"
          >
            Edit this month
          </button>
        </div>
      )}

      {/* INCOME */}
      <div>
        <SectionHeader title="Income" total={incomeTotal} totalColor="text-green" />
        <div className="space-y-3">
          <NumberInput label="Primary income (take-home, after tax)" value={form.primaryIncome} onChange={v => onChange("primaryIncome", v)} readOnly={isReadOnly} />
          <NumberInput label="Secondary income" value={form.secondaryIncome} onChange={v => onChange("secondaryIncome", v)} placeholder="Freelance, consulting…" readOnly={isReadOnly} />
          <NumberInput label="Rental income" value={form.rentalIncome} onChange={v => onChange("rentalIncome", v)} placeholder="From investment properties" readOnly={isReadOnly} />
          <NumberInput label="Other income" value={form.otherIncome} onChange={v => onChange("otherIncome", v)} placeholder="Dividends, bonuses…" readOnly={isReadOnly} />
        </div>
      </div>

      {/* EXPENSES */}
      <div>
        <SectionHeader title="Monthly expenses" total={expenseTotal} totalColor="text-clay" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPENSE_CATEGORIES.map(cat => (
            <NumberInput
              key={cat.key}
              label={<>{cat.icon}{cat.label}</>}
              value={form[cat.key as keyof BudgetFormState]}
              onChange={v => onChange(cat.key as keyof BudgetFormState, v)}
              readOnly={isReadOnly}
            />
          ))}
        </div>
      </div>

      {/* INVESTMENT CONTRIBUTIONS */}
      <div>
        <SectionHeader title="Investment contributions" total={investTotal} totalColor="text-green" />
        <p className="text-xs text-ink-30 mb-3">Fixed monthly amounts going into your investments.</p>
        <div className="space-y-3">
          {syncedContributions.map(c => (
            <InvestmentContributionRow key={c.source_id} contribution={c} />
          ))}
          <HoldingContributionPicker
            holdings={holdings}
            entries={holdingContributions}
            onChange={onHoldingContributionsChange}
            isReadOnly={isReadOnly}
          />
          <NumberInput
            label="Unattributed / other contributions"
            value={form.otherInvestments}
            onChange={v => onChange("otherInvestments", v)}
            placeholder="e.g. brokerage top-ups, crypto buys"
            readOnly={isReadOnly}
          />
        </div>
        {investTotal > 0 && (
          <p className="text-sm font-semibold text-green mt-3">
            Total monthly investments: ${Math.round(investTotal).toLocaleString()}
          </p>
        )}
      </div>

      {/* SAVE */}
      {(!isReadOnly || isCurrentMonth) && (
        <button
          onClick={onSave}
          disabled={isReadOnly || saving}
          className="w-full min-h-11 py-3 rounded-xl bg-forest text-paper font-semibold text-sm hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save budget"}
        </button>
      )}
    </div>
  );
}
