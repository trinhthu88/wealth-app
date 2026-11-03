import { AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import CurrencyField from "@/components/shared/CurrencyField";
import { formatPct } from "@/lib/currencyUtils";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  inforce:  { label: "In force",    className: "bg-forest text-paper" },
  matured:  { label: "Matured",     className: "bg-field text-forest" },
  surrender:{ label: "Surrendered", className: "bg-sun text-forest" },
  scenario: { label: "Scenario",    className: "bg-paper text-ink-40" },
};

// Leading tile colour by plan status.
const TILE_CONFIG: Record<string, string> = {
  inforce: "bg-forest text-paper",
  matured: "bg-field text-forest",
  surrender: "bg-breeze text-forest",
  scenario: "bg-paper text-forest",
};

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

interface Props {
  plan: AdvisedPlan;
  onOpen: () => void;
}

export default function AdvisedPlanCardFull({ plan, onOpen }: Props) {
  const cv = parseFloat(plan.latestAccountValue) || 0;
  const isPending = cv === 0;
  const isGain = plan.gainLoss >= 0;
  const status = STATUS_CONFIG[plan.status] ?? { label: plan.status, className: "bg-paper text-ink-40" };
  const name = plan.nickname ?? plan.productName;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left p-3 border-b border-hairline last:border-0 rounded-[20px] transition-colors hover:bg-paper/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-11 w-11 flex-none items-center justify-center rounded-[14px] text-[12px] font-semibold",
            TILE_CONFIG[plan.status] ?? "bg-paper text-forest",
          )}
        >
          {initialsFor(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-forest leading-tight">{name}</h3>
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="text-[13px] text-ink-40 truncate">
            {plan.providerName}{plan.policyNumber ? ` · ${plan.policyNumber}` : ""}
          </p>
        </div>

        {!isPending && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="sr-only">Account value</span>
            <p className="text-[15px] font-semibold text-forest tabular-nums leading-none">
              <CurrencyField amountUsd={cv} currency={plan.currency} compact />
            </p>
            <span className="sr-only">Gain / loss</span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums text-forest",
              isGain ? "bg-field" : "bg-sun",
            )}>
              <CurrencyField amountUsd={plan.gainLoss} currency={plan.currency} compact showSign />
              {" · "}
              {formatPct(plan.gainLossPct)}
            </span>
          </div>
        )}
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-40" aria-hidden="true" />
      </div>

      {isPending && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-sun-tint rounded-[14px] text-[13px]">
          <AlertCircle className="h-4 w-4 text-clay-ink shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-clay-ink">Your advisor is entering your plan details. This will update within 24 hours.</p>
        </div>
      )}
    </button>
  );
}
