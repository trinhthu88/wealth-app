import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";
import CurrencyField from "@/components/shared/CurrencyField";
import PlanFundBar from "./PlanFundBar";
import { useAdvisedPlanTransactions, type AdvisedPlan } from "@/hooks/useAdvisedPlans";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  plan: AdvisedPlan | null;
  onViewAllStatements: () => void;
}

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

const PLAN_TYPE_LABEL: Record<string, string> = {
  rsp: "Regular Savings Plan",
  lump_sum: "Lump Sum",
  combination: "Combination",
};

export default function AdvisedPlanDetailSheet({ isOpen, onClose, plan, onViewAllStatements }: Props) {
  const { transactions, loading } = useAdvisedPlanTransactions(plan?.id ?? null);

  if (!plan) return null;

  const details: [string, string][] = [
    ["Provider", plan.providerName],
    ["Product", plan.productCode ? `${plan.productName} (${plan.productCode})` : plan.productName],
    ["Policy number", plan.policyNumber ?? "—"],
    ["Plan type", PLAN_TYPE_LABEL[plan.planType] ?? plan.planType],
    ["Effective date", plan.effectiveDate ? new Date(plan.effectiveDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"],
    ["Latest statement", plan.latestStatementDate ? new Date(plan.latestStatementDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"],
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={plan.nickname ?? plan.productName} height="full">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
          {details.map(([label, val]) => (
            <div key={label}>
              <p className="text-[12px] text-ink-40">{label}</p>
              <p className="font-medium text-forest">{val}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-hairline pt-4">
          <p className="text-[12px] font-semibold text-ink-40 uppercase tracking-wide mb-2">Fund allocation</p>
          <PlanFundBar holdings={plan.latestHoldings ?? []} />
        </div>

        <div className="border-t border-hairline pt-4">
          <p className="text-[12px] font-semibold text-ink-40 uppercase tracking-wide mb-2">Transactions</p>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-10 bg-hairline/60 animate-pulse rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-[13.5px] text-ink-40 py-4 text-center">No transactions yet.</p>
          ) : (
            <div className="space-y-1">
              {transactions.map(t => {
                const amt = n(t.netAmount);
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13.5px] text-forest truncate">{t.description}</p>
                      <p className="text-[12px] text-ink-40">
                        {new Date(t.transactionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <span className={cn("text-[13.5px] font-semibold tabular-nums shrink-0 ml-3", amt >= 0 ? "text-green" : "text-clay")}>
                      {amt >= 0 ? "+" : ""}
                      <CurrencyField amountUsd={amt} currency={plan.currency} compact />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onViewAllStatements}
          className="w-full min-h-11 rounded-[14px] border border-hairline text-[13.5px] font-semibold text-green hover:bg-green-tint transition-colors"
        >
          View full statement history
        </button>
      </div>
    </BottomSheet>
  );
}
