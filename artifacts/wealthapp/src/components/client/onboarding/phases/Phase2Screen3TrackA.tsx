import { Clock } from "lucide-react";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import { formatCurrency } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  inforce:    { label: "Active",    color: "bg-emerald-100 text-emerald-700" },
  paid_up:    { label: "Paid up",   color: "bg-blue-100 text-blue-700" },
  lapsed:     { label: "Lapsed",    color: "bg-red-100 text-red-700" },
  matured:    { label: "Matured",   color: "bg-slate-100 text-slate-600" },
  surrendered:{ label: "Surrendered",color: "bg-slate-100 text-slate-600" },
};

function PlanCard({ plan }: { plan: AdvisedPlan }) {
  const status = STATUS_MAP[plan.status] ?? { label: plan.status, color: "bg-slate-100 text-slate-600" };
  const currentValue = parseFloat(plan.latestAccountValue) || 0;
  const netContrib = parseFloat(plan.latestNetContribution) || 0;

  return (
    <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">{plan.providerName}</p>
          <p className="font-semibold text-[#042C53]">{plan.productName}</p>
          {plan.policyNumber && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">{plan.policyNumber}</p>
          )}
        </div>
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full shrink-0", status.color)}>
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Current value</p>
          <p className="font-bold text-[#042C53]">{formatCurrency(currentValue, plan.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Effective date</p>
          <p className="font-medium text-sm text-[#042C53]">
            {plan.effectiveDate ? new Date(plan.effectiveDate).toLocaleDateString("en-GB") : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Net contribution</p>
          <p className="font-bold text-[#042C53]">{formatCurrency(netContrib, plan.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Maturity date</p>
          <p className="font-medium text-sm text-[#042C53]">
            {plan.maturityDate ? new Date(plan.maturityDate).toLocaleDateString("en-GB") : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  plans: AdvisedPlan[];
  hasPendingAdvisorSetup: boolean;
}

export default function Phase2Screen3TrackA({ plans, hasPendingAdvisorSetup }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Your investment plan</h1>
        <p className="text-sm text-slate-500">Your advisor has already set this up for you.</p>
      </div>

      {hasPendingAdvisorSetup ? (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <Clock className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">Your advisor is setting things up</p>
            <p className="text-sm text-blue-700">
              Your portfolio will appear here within 24 hours. You can complete the rest of your profile now.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
        </div>
      )}

      <div className="pt-2 space-y-1">
        <p className="text-sm text-slate-500">Your advisor manages these plans on your behalf.</p>
        <p className="text-sm text-slate-500">You can add your other investments on the next screen.</p>
      </div>
    </div>
  );
}
