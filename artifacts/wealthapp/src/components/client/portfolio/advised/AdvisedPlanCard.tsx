import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, AlertCircle, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import CurrencyField from "@/components/shared/CurrencyField";
import { formatPct } from "@/lib/currencyUtils";
import PlanFundBar from "./PlanFundBar";
import SourceBadge from "@/components/client/portfolio/shared/SourceBadge";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  inforce:    { label: "Active",      color: "bg-emerald-100 text-emerald-700" },
  paid_up:    { label: "Paid up",     color: "bg-blue-100 text-blue-700" },
  lapsed:     { label: "Lapsed",      color: "bg-red-100 text-red-700" },
  matured:    { label: "Matured",     color: "bg-slate-100 text-slate-600" },
  surrendered:{ label: "Surrendered", color: "bg-red-100 text-red-600" },
};

function maturityText(maturityDate: string | null): string | null {
  if (!maturityDate) return null;
  const d = new Date(maturityDate);
  const now = new Date();
  if (d < now) return `Matured ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
  const months = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} month${rem !== 1 ? "s" : ""} away`;
  return `${years} year${years !== 1 ? "s" : ""} ${rem > 0 ? `${rem} month${rem !== 1 ? "s" : ""}` : ""} away`.trim();
}

interface Props {
  plan: AdvisedPlan;
  onViewStatements: () => void;
}

export default function AdvisedPlanCardFull({ plan, onViewStatements }: Props) {
  const [expanded, setExpanded] = useState(false);

  const cv = parseFloat(plan.latestAccountValue) || 0;
  const nc = parseFloat(plan.latestNetContribution) || 0;
  const isPending = cv === 0;
  const isGain = plan.gainLoss >= 0;
  const status = STATUS_CONFIG[plan.status] ?? { label: plan.status, color: "bg-slate-100 text-slate-600" };
  const maturity = maturityText(plan.maturityDate);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[#042C53]">{plan.nickname ?? plan.productName}</p>
              <SourceBadge kind="advised" />
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0", status.color)}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {plan.providerName}{plan.policyNumber ? ` · ${plan.policyNumber}` : ""}
              {plan.latestStatementDate && ` · Last reviewed ${new Date(plan.latestStatementDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
            </p>
          </div>
        </div>

        {isPending ? (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-amber-700">Your advisor is entering your plan details. This will update within 24 hours.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Net contribution</p>
                <p className="text-sm font-semibold text-[#042C53]"><CurrencyField amountUsd={nc} currency={plan.currency} compact /></p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Account value</p>
                <p className="text-sm font-semibold text-[#042C53]"><CurrencyField amountUsd={cv} currency={plan.currency} compact /></p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Gain / loss</p>
                <p className={cn("text-sm font-semibold", isGain ? "text-emerald-600" : "text-red-500")}>
                  <CurrencyField amountUsd={plan.gainLoss} currency={plan.currency} compact showSign />
                </p>
                <p className={cn("text-xs", isGain ? "text-emerald-500" : "text-red-400")}>
                  {formatPct(plan.gainLossPct)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">CAGR</p>
                <p className={cn("text-sm font-semibold", plan.cagr >= 0 ? "text-emerald-600" : "text-red-500")}>
                  {plan.cagr ? `${formatPct(plan.cagr, 1)}/yr` : "--"}
                </p>
              </div>
            </div>

            <PlanFundBar holdings={plan.latestHoldings ?? []} />
          </>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onViewStatements}
            className="flex items-center gap-1 text-xs font-medium text-[#1D9E75] hover:text-[#0F6E56]"
          >
            View statements <ExternalLink className="h-3 w-3" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Collapse</> : <><ChevronDown className="h-3.5 w-3.5" /> Expand</>}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && !isPending && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            {[
              ["Provider", plan.providerName],
              ["Product", `${plan.productName}${plan.productCode ? ` (${plan.productCode})` : ""}`],
              ["Policy number", plan.policyNumber ?? "—"],
              ["Plan type", plan.planType === "rsp" ? "Regular Savings Plan" : plan.planType === "lump_sum" ? "Lump Sum" : "Combination"],
              ["Annual premium", plan.annualPremium ? `$${parseFloat(plan.annualPremium).toLocaleString()} ($${(parseFloat(plan.annualPremium) / 12).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo)` : "—"],
              ["Effective date", plan.effectiveDate ? new Date(plan.effectiveDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"],
              ["Maturity date", plan.maturityDate ? `${new Date(plan.maturityDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${maturity ? ` (${maturity})` : ""}` : "—"],
              ["Status", status.label],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="font-medium text-[#042C53]">{val}</p>
              </div>
            ))}
          </div>

          {/* Ask advisor link */}
          <div className="border-t border-slate-200 pt-3">
            <Link
              href={`/client/messages?about=${encodeURIComponent(plan.nickname ?? plan.productName)}`}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1D9E75] hover:text-[#0F6E56] transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask your advisor a question about this plan →
            </Link>
          </div>

          {plan.latestStatement && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Latest statement</p>
              <p className="text-xs text-slate-500">
                {new Date(plan.latestStatement.periodStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                {" – "}
                {new Date(plan.latestStatement.periodEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                {[
                  ["Opening", `$${parseFloat(plan.latestStatement.openingValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}`],
                  ["Contributions", `+$${parseFloat(plan.latestStatement.contributions).toLocaleString("en-US", { maximumFractionDigits: 0 })}`],
                  ["Closing", `$${parseFloat(plan.latestStatement.closingValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}`],
                ].map(([l, v]) => (
                  <div key={l}><p className="text-slate-400">{l}</p><p className="font-medium text-[#042C53]">{v}</p></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
