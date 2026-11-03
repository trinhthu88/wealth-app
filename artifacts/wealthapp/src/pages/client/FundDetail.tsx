import { useParams, Link, useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import CurrencyField from "@/components/shared/CurrencyField";
import SolNarration from "@/components/client/SolNarration";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { usePlan } from "@/hooks/usePlan";

const FUND_COLORS = ["var(--forest)", "var(--field)", "var(--breeze)", "var(--forest-700)", "var(--mint-dim)"];

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
          <div className="h-40 bg-surface animate-pulse rounded-[28px]" />
        </div>
      </ClientAppShell>
    );
  }

  if (!plan || !fund) {
    return (
      <ClientAppShell>
        <div className="text-center py-16">
          <p className="text-[14px] text-ink-40 mb-4">This fund could not be found.</p>
          <Link href={planId ? `/client/wealth/investments/${planId}` : "/client/wealth/investments"} className="text-[14px] font-semibold text-green">Back to plan</Link>
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
            href={`/client/wealth/investments/${plan.id}`}
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-ink-40 hover:text-forest mb-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {plan.nickname ?? plan.productName}
          </Link>
          <h1 className="font-display text-[34px] leading-[1.05] text-forest">{fund.fundName}</h1>
          <p className="text-[14px] text-ink-40 mt-1">Inside {plan.nickname ?? plan.productName}</p>
        </div>

        <SolNarration
          line={`This fund is ${sharePct}% of your plan.${sharePct >= 50 ? " Concentration that size is worth raising with " + (advisorFirstName ?? "your advisor") + "." : ""}`}
          detail="Holding a large share of a plan in one fund means its performance largely is your performance. That can be entirely appropriate for the mandate you're on — it's a question of whether it still matches your goals. Your advisor is the one to sign off on any change."
          advisorFirstName={advisorFirstName}
        />

        <section aria-label="Holding value" className="bg-forest text-paper rounded-[28px] p-5 flex flex-col gap-3">
          <p className="tala-eyebrow text-mint">Holding value</p>
          <p className="font-display tabular-nums text-[52px] leading-none tracking-[-0.04em] text-paper">
            <CurrencyField amountUsd={value} currency={plan.currency} compact />
          </p>
          <span className="self-start rounded-full bg-field px-3 py-1.5 text-[13px] font-semibold text-forest tabular-nums">{sharePct}% of plan</span>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {stats.map(s => (
              <div key={s.k} className="bg-white/10 rounded-[14px] p-3">
                <div className="tala-eyebrow text-mint">{s.k}</div>
                <div className="mt-1 text-[16px] font-semibold text-paper tabular-nums">{s.v}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="bg-surface rounded-[24px] p-5">
          <h2 className="text-[16px] font-semibold text-forest mb-1">Where new money goes</h2>
          <p className="text-[14px] text-ink-60 leading-relaxed mb-3.5 text-pretty">
            Future contributions split by the allocation your advisor set at outset. Changing it is an advised decision.
          </p>
          <div className="space-y-3">
            {holdings.map((h, i) => (
              <div key={h.id}>
                <div className="flex justify-between text-[14px] mb-1">
                  <span className="text-forest font-medium truncate pr-2">{h.fundName}</span>
                  <span className="text-ink-40 shrink-0 tabular-nums">{Math.round(n(h.futureAllocationPct))}%</span>
                </div>
                <div className="h-2 rounded-full bg-forest/15 overflow-hidden">
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
            onClick={() => navigate("/client/advisor/messages")}
            className="mt-5 w-full h-12 px-5 text-center bg-forest text-paper rounded-full text-[14px] font-semibold hover:bg-forest-700 transition-colors"
          >
            Message {advisorFirstName ?? "your advisor"} about allocation
          </button>
        </div>
      </div>
    </ClientAppShell>
  );
}
