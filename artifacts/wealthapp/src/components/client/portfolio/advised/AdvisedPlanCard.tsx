import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import CurrencyField from "@/components/shared/CurrencyField";
import { formatPct } from "@/lib/currencyUtils";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  inforce:  { label: "In force",    className: "bg-green-tint text-green" },
  matured:  { label: "Matured",     className: "bg-sun-tint text-amber-ink" },
  surrender:{ label: "Surrendered", className: "bg-clay-tint text-clay-ink" },
  scenario: { label: "Scenario",    className: "bg-hairline text-ink-40" },
};

interface Props {
  plan: AdvisedPlan;
  onOpen: () => void;
}

export default function AdvisedPlanCardFull({ plan, onOpen }: Props) {
  const cv = parseFloat(plan.latestAccountValue) || 0;
  const isPending = cv === 0;
  const isGain = plan.gainLoss >= 0;
  const status = STATUS_CONFIG[plan.status] ?? { label: plan.status, className: "bg-hairline text-ink-40" };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-surface rounded-[26px] p-[20px_22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] transition-all hover:shadow-[0_4px_20px_rgba(20,52,42,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-[20px] font-semibold text-forest leading-none">{plan.nickname ?? plan.productName}</h3>
            <span className={cn("text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-md shrink-0", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="text-[13.5px] text-ink-40">
            {plan.providerName}{plan.policyNumber ? ` · ${plan.policyNumber}` : ""}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-30 mt-1" aria-hidden="true" />
      </div>

      {isPending ? (
        <div className="flex items-start gap-2 p-3 bg-sun-tint rounded-[14px] text-[13px]">
          <AlertCircle className="h-4 w-4 text-sun-deep shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-amber-ink">Your advisor is entering your plan details. This will update within 24 hours.</p>
        </div>
      ) : (
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[13.5px] text-ink-40 mb-1">Account value</p>
            <p className="font-display text-[22px] font-semibold text-forest tabular-nums leading-none">
              <CurrencyField amountUsd={cv} currency={plan.currency} compact />
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13.5px] text-ink-40 mb-1">Gain / loss</p>
            <p className={cn("text-[15px] font-semibold tabular-nums leading-none mb-1", isGain ? "text-green" : "text-clay")}>
              <CurrencyField amountUsd={plan.gainLoss} currency={plan.currency} compact showSign />
            </p>
            <p className={cn("text-[12.5px] font-medium leading-none", isGain ? "text-green" : "text-clay")}>
              {formatPct(plan.gainLossPct)}
            </p>
          </div>
        </div>
      )}
    </button>
  );
}
