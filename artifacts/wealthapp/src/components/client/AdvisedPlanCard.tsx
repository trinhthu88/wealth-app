import { Link } from "wouter";
import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import CurrencyField from "@/components/shared/CurrencyField";
import { formatPct } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";

interface AdvisedPlanCardProps {
  plan: AdvisedPlan;
  href?: string;
}

export default function AdvisedPlanCard({ plan, href }: AdvisedPlanCardProps) {
  const currentValue = parseFloat(plan.latestAccountValue) || 0;
  const isPositive = plan.gainLoss >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  const content = (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-[#1D9E75]/40 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-slate-500 truncate">
              {plan.providerName}
            </span>
            {plan.status !== "inforce" && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                {plan.status}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[#042C53] truncate">
            {plan.nickname ?? plan.productName}
          </p>
          {plan.policyNumber && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">{plan.policyNumber}</p>
          )}
        </div>
        {href && <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />}
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Account value</p>
          <p className="text-xl font-bold text-[#042C53]">
            <CurrencyField amountUsd={currentValue} currency={plan.currency} />
          </p>
        </div>
        <div className="text-right">
          <div className={cn(
            "flex items-center gap-1 justify-end text-sm font-semibold",
            isPositive ? "text-emerald-600" : "text-red-500"
          )}>
            <TrendIcon className="h-3.5 w-3.5" />
            {formatPct(plan.gainLossPct)}
          </div>
          <p className="text-xs text-slate-400">
            {isPositive ? "+" : ""}
            <CurrencyField amountUsd={plan.gainLoss} currency={plan.currency} showSign />
          </p>
        </div>
      </div>

      {plan.latestStatementDate && (
        <p className="text-[11px] text-slate-400 mt-2">
          Statement: {new Date(plan.latestStatementDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        </p>
      )}
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
