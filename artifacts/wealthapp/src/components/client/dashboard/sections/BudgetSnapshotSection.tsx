import { Link } from "wouter";
import { cn } from "@/lib/utils";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import type { ClientBudgetMonth } from "@/hooks/useClientBudget";

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }

function SavingsBadge({ rate }: { rate: number }) {
  if (rate >= 20) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Great</span>;
  if (rate >= 10) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Good</span>;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Low</span>;
}

interface Props {
  budget: ClientBudgetMonth | null;
  isTrackA: boolean;
  planNickname?: string;
}

export default function BudgetSnapshotSection({ budget, isTrackA, planNickname }: Props) {
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isEmpty = !budget;

  const income = n(budget?.totalIncome);
  const expenses = n(budget?.totalExpenses);
  const investments = n(budget?.totalInvestments);
  const surplus = n(budget?.netSurplus);
  const savingsRate = n(budget?.savingsRatePct);

  const rspAmount = budget?.investmentContributions
    ? (budget.investmentContributions as any[]).reduce((s: number, c: any) => s + (c.amount || 0), 0)
    : 0;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#042C53]">Budget · {monthLabel}</p>
      </div>

      {isEmpty ? (
        <div className="py-4 text-center space-y-2">
          <p className="text-sm text-[#64748B]">No budget set for this month.</p>
          <Link href="/client/budget">
            <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">Set up budget →</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {[
              { label: "Income", value: income, color: "" },
              { label: "Expenses", value: expenses, color: "text-red-500" },
              { label: "Investments", value: investments, color: "text-blue-500" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">{row.label}</span>
                <span className={cn("font-medium text-[#042C53]", row.color)}>
                  <CurrencyDisplay amountUsd={row.value} compact />
                </span>
              </div>
            ))}
            {isTrackA && rspAmount > 0 && (
              <p className="text-[11px] text-[#64748B] pl-1">
                Includes <CurrencyDisplay amountUsd={rspAmount} compact /> RSP{planNickname ? ` (${planNickname})` : ""}
              </p>
            )}

            <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-sm font-semibold">
              <span className="text-[#042C53]">Surplus</span>
              <div className="flex items-center gap-2">
                <span className={surplus >= 0 ? "text-emerald-600" : "text-red-500"}>
                  <CurrencyDisplay amountUsd={surplus} compact />
                </span>
                <SavingsBadge rate={savingsRate} />
              </div>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span>Savings rate</span>
              <span>{savingsRate.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1D9E75] rounded-full transition-all"
                style={{ width: `${Math.min(100, savingsRate)}%` }}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/client/budget">
              <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">View full budget →</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
