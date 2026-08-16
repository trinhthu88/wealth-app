import { formatCurrency } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";

export interface ExpenseData {
  housing: number;
  food: number;
  transport: number;
  utilities: number;
  entertainment: number;
  other: number;
}

const EXPENSE_ROWS = [
  { key: "housing",       emoji: "🏠", label: "Housing (rent / mortgage)" },
  { key: "food",          emoji: "🍜", label: "Food & dining" },
  { key: "transport",     emoji: "🚌", label: "Transport" },
  { key: "utilities",     emoji: "⚡", label: "Utilities & bills" },
  { key: "entertainment", emoji: "🎬", label: "Entertainment & lifestyle" },
  { key: "other",         emoji: "···", label: "Other expenses" },
] as const;

interface Props {
  monthlyIncome: number;
  incomeCurrency: string;
  isTrackA: boolean;
  advisedPlans: AdvisedPlan[];
  expenses: ExpenseData;
  extraInvestment: number;
  preferredCurrency: string;
  onExpenseChange: (key: keyof ExpenseData, value: number) => void;
  onExtraInvestmentChange: (v: number) => void;
}

function savingsRateBadge(rate: number) {
  if (rate >= 20) return { label: "Great savings rate", color: "bg-emerald-100 text-emerald-700" };
  if (rate >= 10) return { label: "Building habits", color: "bg-amber-100 text-amber-700" };
  return { label: "Room to grow", color: "bg-red-100 text-red-600" };
}

export default function Phase3Screen7Budget({ monthlyIncome, incomeCurrency, isTrackA, advisedPlans, expenses, extraInvestment, preferredCurrency, onExpenseChange, onExtraInvestmentChange }: Props) {
  const totalExpenses = Object.values(expenses).reduce((s, v) => s + v, 0);
  const advisedMonthly = isTrackA
    ? advisedPlans.reduce((s, p) => s + (parseFloat(p.annualPremium) || 0) / 12, 0)
    : 0;
  const totalInvestments = advisedMonthly + extraInvestment;
  const surplus = monthlyIncome - totalExpenses - totalInvestments;
  const savingsRate = monthlyIncome > 0 ? (surplus / monthlyIncome) * 100 : 0;
  const badge = savingsRateBadge(savingsRate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Your monthly expenses</h1>
        <p className="text-sm text-slate-500">A quick snapshot — you can update this any time.</p>
      </div>

      {/* Income display */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
        <span className="text-sm text-slate-500">Monthly income</span>
        <span className="text-sm font-semibold text-[#042C53]">
          {formatCurrency(monthlyIncome, incomeCurrency)}
        </span>
      </div>

      {/* Expense rows */}
      <div className="space-y-3">
        {EXPENSE_ROWS.map(({ key, emoji, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-6 text-center text-lg shrink-0">{emoji}</span>
            <label className="flex-1 text-sm text-[#042C53]">{label}</label>
            <input
              type="number"
              min={0}
              value={expenses[key] || ""}
              onChange={e => onExpenseChange(key, parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm text-right text-[#042C53] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
            />
          </div>
        ))}
      </div>

      {/* Investment contributions */}
      <div className="space-y-2 pt-1">
        <p className="text-sm font-semibold text-[#042C53]">Monthly investment contributions</p>
        {isTrackA && advisedMonthly > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-[#1D9E75]/5 rounded-xl border border-[#1D9E75]/20">
            <div>
              <p className="text-sm font-medium text-[#042C53]">
                {advisedPlans[0]?.nickname ?? advisedPlans[0]?.productName ?? "Advised plan"}
              </p>
              <p className="text-xs text-slate-500">Your regular plan contribution</p>
            </div>
            <span className="text-sm font-semibold text-[#1D9E75]">
              {formatCurrency(advisedMonthly, advisedPlans[0]?.currency ?? "USD")}/mo
            </span>
          </div>
        )}
        {!isTrackA && (
          <div className="flex items-center gap-3">
            <label className="flex-1 text-sm text-[#042C53]">Monthly investment amount</label>
            <input
              type="number"
              min={0}
              value={extraInvestment || ""}
              onChange={e => onExtraInvestmentChange(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm text-right text-[#042C53] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75]"
            />
          </div>
        )}
      </div>

      {/* Live summary */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
        {[
          { label: "Income", value: monthlyIncome, currency: incomeCurrency, highlight: false },
          { label: "Expenses", value: -totalExpenses, currency: preferredCurrency, highlight: false },
          { label: "Investments", value: -totalInvestments, currency: preferredCurrency, highlight: false },
        ].map(({ label, value, currency, highlight }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className={cn("font-medium", value >= 0 ? "text-[#042C53]" : "text-slate-600")}>
              {formatCurrency(Math.abs(value), currency)}
            </span>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#042C53]">Monthly surplus</span>
          <span className={cn("font-bold text-sm", surplus >= 0 ? "text-emerald-600" : "text-red-500")}>
            {formatCurrency(surplus, preferredCurrency)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Savings rate</span>
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", badge.color)}>
            {savingsRate.toFixed(0)}% — {badge.label}
          </span>
        </div>
      </div>
    </div>
  );
}
