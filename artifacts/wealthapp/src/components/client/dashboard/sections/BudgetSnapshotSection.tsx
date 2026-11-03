import { Link } from "wouter";
import { cn } from "@/lib/utils";
import CurrencyField from "@/components/shared/CurrencyField";
import type { ClientBudgetMonth } from "@/hooks/useClientBudget";

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }

function SavingsBadge({ rate }: { rate: number }) {
  if (rate >= 20) return <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-forest text-paper">Great</span>;
  if (rate >= 10) return <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-breeze text-forest">Good</span>;
  return <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-red-100 text-clay-ink">Low</span>;
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
    <div className="bg-surface rounded-[24px] p-4 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-forest">Budget · {monthLabel}</p>
      </div>

      {isEmpty ? (
        <div className="py-4 text-center space-y-2">
          <p className="text-sm text-ink-40">No budget set for this month.</p>
          <Link href="/client/money">
            <span className="text-sm font-medium text-forest underline underline-offset-4">Set up budget →</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {[
              { label: "Income", value: income, color: "" },
              { label: "Expenses", value: expenses, color: "text-clay-ink" },
              { label: "Investments", value: investments, color: "text-forest" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-ink-40">{row.label}</span>
                <span className={cn("font-medium text-forest", row.color)}>
                  <CurrencyField amountUsd={row.value} compact />
                </span>
              </div>
            ))}
            {isTrackA && rspAmount > 0 && (
              <p className="text-[11px] text-ink-40 pl-1">
                Includes <CurrencyField amountUsd={rspAmount} compact /> RSP{planNickname ? ` (${planNickname})` : ""}
              </p>
            )}

            <div className="border-t border-hairline pt-2 flex items-center justify-between text-sm font-semibold">
              <span className="text-forest">Surplus</span>
              <div className="flex items-center gap-2">
                <span className={surplus >= 0 ? "text-forest" : "text-clay-ink"}>
                  <CurrencyField amountUsd={surplus} compact />
                </span>
                <SavingsBadge rate={savingsRate} />
              </div>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px] text-ink-40">
              <span>Savings rate</span>
              <span>{savingsRate.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-forest/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-forest rounded-full transition-all"
                style={{ width: `${Math.min(100, savingsRate)}%` }}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/client/money">
              <span className="text-sm font-medium text-forest underline underline-offset-4">View full budget →</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
