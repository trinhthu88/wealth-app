import { CheckCircle2, AlertTriangle } from "lucide-react";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import SavingsRateGauge from "./SavingsRateGauge";
import { cn } from "@/lib/utils";

interface Props {
  selectedMonthLabel: string;
  income: number;
  expenses: number;
  investments: number;
}

export default function BudgetSummaryPanel({ selectedMonthLabel, income, expenses, investments }: Props) {
  const surplus = income - expenses - investments;
  const savingsRatePct = income > 0 ? (surplus / income) * 100 : 0;
  const isDeficit = surplus < 0;
  const isZero = surplus === 0;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-4 lg:sticky lg:top-6">
      <p className="text-sm font-semibold text-[#042C53]">{selectedMonthLabel} summary</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Income</span>
          <span className="font-semibold text-[#1D9E75]">
            <CurrencyDisplay amountUsd={income} compact />
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Expenses</span>
          <span className="font-semibold text-red-500">
            − <CurrencyDisplay amountUsd={expenses} compact />
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Investments</span>
          <span className="font-semibold text-[#1D9E75]">
            − <CurrencyDisplay amountUsd={investments} compact />
          </span>
        </div>

        <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-sm font-bold">
          <span className="text-[#042C53]">Surplus</span>
          <div className="flex items-center gap-1.5">
            {isDeficit ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : isZero ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            <span className={cn(
              isDeficit ? "text-red-500" : isZero ? "text-amber-500" : "text-emerald-600"
            )}>
              <CurrencyDisplay amountUsd={surplus} compact />
            </span>
          </div>
        </div>

        {isDeficit && (
          <p className="text-xs text-red-500">
            You're spending <CurrencyDisplay amountUsd={Math.abs(surplus)} compact /> more than you earn this month.
          </p>
        )}
      </div>

      {/* Savings rate bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Savings rate</span>
          <span className={cn(
            "font-semibold",
            savingsRatePct >= 20 ? "text-[#1D9E75]" : savingsRatePct >= 10 ? "text-amber-600" : "text-red-500"
          )}>
            {savingsRatePct < 0 ? "–" : `${Math.round(Math.max(0, savingsRatePct))}%`}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, savingsRatePct))}%`,
              background: savingsRatePct >= 20 ? "#1D9E75" : savingsRatePct >= 10 ? "#F59E0B" : "#EF4444",
            }}
          />
        </div>
        <p className="text-[10px] text-slate-400 text-right">
          {savingsRatePct >= 20 ? "Good" : savingsRatePct >= 10 ? "Growing" : "Low"}
        </p>
      </div>

      <SavingsRateGauge savingsRatePct={savingsRatePct} />
    </div>
  );
}
