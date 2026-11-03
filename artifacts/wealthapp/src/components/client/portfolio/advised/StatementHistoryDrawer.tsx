import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
      <div className="grid grid-cols-3 gap-2 mb-5 bg-surface rounded-[24px] p-4 text-[14px]">
        <div>
          <span className="tala-eyebrow text-ink-40">Net contribution</span>
          <p className="mt-1 text-[16px] font-semibold text-forest tabular-nums">${nc.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <span className="tala-eyebrow text-ink-40">Account value</span>
          <p className="mt-1 text-[16px] font-semibold text-forest tabular-nums">${cv.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <span className="tala-eyebrow text-ink-40">Gain / loss</span>
          <p className={cn("mt-1 text-[16px] font-semibold tabular-nums", isPos ? "text-forest" : "text-clay-ink")}>
            {isPos ? "+" : "-"}${Math.abs(gl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {statements.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[14px] text-ink-40">No statements yet.</p>
          <p className="text-[13px] text-ink-40 mt-1">Your advisor will add your first statement soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...statements].sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()).map(stmt => {
            const closingV = n(stmt.closingValue);
            const returns = n(stmt.investmentReturns);
            const isExpanded = expandedId === stmt.id;
            const isReturnPos = returns >= 0;

            return (
              <div key={stmt.id} className="bg-surface rounded-[24px] overflow-hidden">
                <button
                  className="w-full min-h-11 flex items-center justify-between p-4 text-left hover:bg-paper/60 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : stmt.id)}
                >
                  <div>
                    <p className="text-[15px] font-semibold text-forest">{periodLabel(stmt)}</p>
                    <p className="text-[13px] text-ink-40 mt-0.5 tabular-nums">
                      Closing: ${closingV.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums text-forest", isReturnPos ? "bg-field" : "bg-sun")}>
                      {isReturnPos ? "+" : ""}${returns.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-ink-40 transition-transform", isExpanded ? "rotate-180" : "")} aria-hidden="true" />
                  </div>
                </button>
                {isExpanded && (
                  <div className="p-4 border-t border-hairline bg-paper rounded-b-[24px]">
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

      <p className="text-[12px] text-ink-40 text-center mt-6">Statement data is entered by your advisor.</p>
    </BottomSheet>
  );
}
