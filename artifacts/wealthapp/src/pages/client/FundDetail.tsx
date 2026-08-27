import { useParams, Link, useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import CurrencyField from "@/components/shared/CurrencyField";
import SolNarration from "@/components/client/SolNarration";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { usePlan } from "@/hooks/usePlan";

const FUND_COLORS = ["var(--green)", "var(--forest)", "var(--green-300)", "var(--sun)", "var(--sand)"];

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

export default function FundDetail() {
  const { planId, fundCode } = useParams<{ planId: string; fundCode: string }>();
  const [, navigate] = useLocation();
  const { plans, loading } = useAdvisedPlans();
  const { advisorName } = usePlan();

  const plan = plans.find(p => p.id === planId);
  const holdings = plan?.latestHoldings ?? [];
  const fund = holdings.find(h => h.fundCode === fundCode);
  const totalHoldingValue = holdings.reduce((s, h) => s + n(h.finalValue), 0);
  const advisorFirstName = advisorName?.split(" ")[0] ?? null;

  if (loading) {
    return (
      <ClientAppShell>
        <div className="space-y-3">
          <div className="h-8 w-40 bg-surface animate-pulse rounded-lg" />
          <div className="h-40 bg-surface animate-pulse rounded-[26px]" />
        </div>
      </ClientAppShell>
    );
  }

  if (!plan || !fund) {
    return (
      <ClientAppShell>
        <div className="text-center py-16">
          <p className="text-[15px] text-ink-40 mb-4">This fund could not be found.</p>
          <Link href={planId ? `/client/portfolio/${planId}` : "/client/portfolio"} className="text-[14px] font-semibold text-green">Back to plan</Link>
        </div>
      </ClientAppShell>
    );
  }

  const value = n(fund.finalValue);
  const sharePct = totalHoldingValue > 0 ? Math.round((value / totalHoldingValue) * 100) : 0;

  const stats = [
    { k: "Units held", v: fund.unitsHeld ? Number(fund.unitsHeld).toLocaleString() : "—" },
    { k: "Unit price", v: fund.unitValue ? `$${Number(fund.unitValue).toFixed(2)}` : "—" },
    { k: "Priced", v: fund.unitValueDate ? new Date(fund.unitValueDate + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—" },
    { k: "Future split", v: `${Math.round(n(fund.futureAllocationPct))}%` },
  ];

  return (
    <ClientAppShell>
      <div className="space-y-4 pb-8">
        <div>
          <Link
            href={`/client/portfolio/${plan.id}`}
            className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink-40 hover:text-forest mb-3"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {plan.nickname ?? plan.productName}
          </Link>
          <h1 className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em]">{fund.fundName}</h1>
          <p className="text-[13.5px] text-ink-40 mt-0.5">Inside {plan.nickname ?? plan.productName}</p>
        </div>

        <SolNarration
          line={`This fund is ${sharePct}% of your plan.${sharePct >= 50 ? " Concentration that size is worth raising with " + (advisorFirstName ?? "your advisor") + "." : ""}`}
          detail="Holding a large share of a plan in one fund means its performance largely is your performance. That can be entirely appropriate for the mandate you're on — it's a question of whether it still matches your goals. Your advisor is the one to sign off on any change."
          advisorFirstName={advisorFirstName}
        />

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <p className="text-[12.5px] font-semibold text-ink-40">Holding value</p>
          <p className="font-display text-[40px] font-semibold text-forest tracking-[-0.03em] tabular-nums">
            <CurrencyField amountUsd={value} currency={plan.currency} compact />
          </p>
          <p className="text-[13.5px] text-ink-40 mb-3.5">{sharePct}% of plan</p>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(s => (
              <div key={s.k} className="bg-paper rounded-[16px] p-[13px_14px]">
                <div className="text-[12px] text-ink-40">{s.k}</div>
                <div className="font-display text-[19px] font-semibold text-forest tracking-[-0.01em]">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <p className="text-[16px] font-semibold text-forest mb-1">Where new money goes</p>
          <p className="text-[13.5px] text-ink-60 leading-relaxed mb-3.5 text-pretty">
            Future contributions split by the allocation your advisor set at outset. Changing it is an advised decision.
          </p>
          <div className="space-y-3">
            {holdings.map((h, i) => (
              <div key={h.id}>
                <div className="flex justify-between text-[13.5px] mb-1">
                  <span className="text-forest font-semibold truncate pr-2">{h.fundName}</span>
                  <span className="text-ink-40 shrink-0">{Math.round(n(h.futureAllocationPct))}%</span>
                </div>
                <div className="h-2 rounded-full bg-hairline-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(n(h.futureAllocationPct))}%`, background: FUND_COLORS[i % FUND_COLORS.length] }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate("/client/messages")}
            className="mt-4 w-full text-center bg-forest text-paper rounded-[16px] py-[13px] text-[14.5px] font-semibold hover:bg-forest-700 transition-colors"
          >
            Message {advisorFirstName ?? "your advisor"} about allocation
          </button>
        </div>
      </div>
    </ClientAppShell>
  );
}
