import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import StatementDetailView from "./StatementDetailView";
import { cn } from "@/lib/utils";
import type { AdvisedPlan, AdvisedPlanStatement, AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plan: AdvisedPlan;
  statements: AdvisedPlanStatement[];
  holdingsByStatement: Record<string, AdvisedPlanHolding[]>;
  transactionsByStatement?: Record<string, any[]>;
}

function periodLabel(s: AdvisedPlanStatement): string {
  const start = new Date(s.periodStart);
  const end = new Date(s.periodEnd);
  const q = Math.floor(start.getMonth() / 3) + 1;
  return `Q${q} ${start.getFullYear()} · ${start.toLocaleDateString("en-US", { month: "short" })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

export default function StatementHistoryDrawer({ isOpen, onClose, plan, statements, holdingsByStatement, transactionsByStatement }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cv = n(plan.latestAccountValue);
  const nc = n(plan.latestNetContribution);
  const gl = cv - nc;
  const isPos = gl >= 0;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`${plan.nickname ?? plan.productName} — Statements`} height="full">
      {/* Plan summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-5 pb-4 border-b border-slate-100 text-sm">
        <div>
          <span className="text-xs text-slate-400">Net contribution</span>
          <p className="font-semibold text-[#042C53]">${nc.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <span className="text-xs text-slate-400">Account value</span>
          <p className="font-semibold text-[#042C53]">${cv.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <span className="text-xs text-slate-400">Gain / loss</span>
          <p className={cn("font-semibold", isPos ? "text-emerald-600" : "text-red-500")}>
            {isPos ? "+" : "-"}${Math.abs(gl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {statements.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">No statements yet.</p>
          <p className="text-xs text-slate-400 mt-1">Your advisor will add your first statement soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...statements].sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()).map(stmt => {
            const closingV = n(stmt.closingValue);
            const returns = n(stmt.investmentReturns);
            const isExpanded = expandedId === stmt.id;
            const isReturnPos = returns >= 0;

            return (
              <div key={stmt.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : stmt.id)}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#042C53]">{periodLabel(stmt)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Closing: ${closingV.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("text-sm font-medium", isReturnPos ? "text-emerald-600" : "text-red-500")}>
                      {isReturnPos ? "+" : ""}${returns.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    <span className={cn("text-xs", isExpanded ? "rotate-180" : "")}>▾</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 py-4 border-t border-slate-100 bg-slate-50">
                    <StatementDetailView
                      statement={stmt}
                      holdings={holdingsByStatement[stmt.id] ?? []}
                      transactions={transactionsByStatement?.[stmt.id]}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-6">Statement data is entered by your advisor.</p>
    </BottomSheet>
  );
}
