import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import CurrencyField from "@/components/shared/CurrencyField";
import SolNarration from "@/components/client/SolNarration";
import StatementHistoryDrawer from "@/components/client/portfolio/advised/StatementHistoryDrawer";
import { formatPct } from "@/lib/currencyUtils";
import { apiFetch } from "@/lib/api";
import { useAdvisedPlans, useAdvisedPlanTransactions, type AdvisedPlanStatement, type AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  inforce:   { label: "In force",    className: "bg-forest text-paper" },
  matured:   { label: "Paid up",     className: "bg-field text-forest" },
  surrender: { label: "Lapsed",      className: "bg-sun text-forest" },
  scenario:  { label: "Scenario",    className: "bg-surface text-forest" },
};

// Leading tile colours for fund rows (background / text).
const FUND_TILES = [
  "bg-forest text-paper",
  "bg-field text-forest",
  "bg-breeze text-forest",
  "bg-paper text-forest",
];

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

function monthKey(dateStr: string) {
  const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function yearsLeft(maturityDate: string | null, termYears: number | null, effectiveDate: string | null): number | null {
  if (maturityDate) {
    const yrs = (new Date(maturityDate).getTime() - Date.now()) / (365.25 * 86_400_000);
    return Math.max(0, Math.round(yrs));
  }
  if (termYears && effectiveDate) {
    const elapsed = (Date.now() - new Date(effectiveDate).getTime()) / (365.25 * 86_400_000);
    return Math.max(0, Math.round(termYears - elapsed));
  }
  return null;
}

export default function AdvisedPlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const [, navigate] = useLocation();
  const { plans, loading: plansLoading } = useAdvisedPlans();
  const { transactions, loading: txLoading } = useAdvisedPlanTransactions(planId ?? null);
  const { advisorName } = usePlan();
  const [historyOpen, setHistoryOpen] = useState(false);

  const plan = plans.find(p => p.id === planId);

  const { data: statements = [] } = useQuery<AdvisedPlanStatement[]>({
    queryKey: ["plan-statements", planId],
    queryFn: () => apiFetch(`/client/advised-plans/${planId}/statements`),
    enabled: historyOpen && !!planId,
  });

  const { data: holdingsMap = {} } = useQuery<Record<string, AdvisedPlanHolding[]>>({
    queryKey: ["plan-statement-holdings", planId],
    queryFn: async () => {
      const map: Record<string, AdvisedPlanHolding[]> = {};
      for (const stmt of statements) {
        map[stmt.id] = await apiFetch<AdvisedPlanHolding[]>(`/client/advised-plans/${planId}/statements/${stmt.id}/holdings`);
      }
      return map;
    },
    enabled: historyOpen && statements.length > 0,
  });

  if (plansLoading) {
    return (
      <ClientAppShell>
        <div className="space-y-3">
          <div className="h-8 w-40 bg-surface animate-pulse rounded-lg" />
          <div className="h-40 bg-surface animate-pulse rounded-[28px]" />
        </div>
      </ClientAppShell>
    );
  }

  if (!plan) {
    return (
      <ClientAppShell>
        <div className="text-center py-16">
          <p className="text-[14px] text-ink-40 mb-4">This plan could not be found.</p>
          <Link href="/client/wealth/investments" className="text-[14px] font-semibold text-green">Back to Investments</Link>
        </div>
      </ClientAppShell>
    );
  }

  const status = STATUS_CONFIG[plan.status] ?? { label: plan.status, className: "bg-surface text-forest" };
  const isGain = plan.gainLoss >= 0;
  const advisorFirstName = advisorName?.split(" ")[0] ?? null;

  const holdings = [...(plan.latestHoldings ?? [])].sort((a, b) => n(b.finalValue) - n(a.finalValue));
  const totalHoldingValue = holdings.reduce((s, h) => s + n(h.finalValue), 0);
  const term = yearsLeft(plan.maturityDate, plan.termYears, plan.effectiveDate);

  const groupedTx: { month: string; rows: typeof transactions }[] = [];
  for (const t of transactions) {
    const key = monthKey(t.transactionDate);
    const group = groupedTx[groupedTx.length - 1];
    if (group && group.month === key) group.rows.push(t);
    else groupedTx.push({ month: key, rows: [t] });
  }

  const netContributed = n(plan.latestNetContribution);
  const solLine = holdings.length > 0 && totalHoldingValue > 0
    ? `${holdings[0].fundName} is ${Math.round((n(holdings[0].finalValue) / totalHoldingValue) * 100)}% of this plan.`
    : `This plan is ${isGain ? "up" : "down"} ${formatPct(Math.abs(plan.gainLossPct))} since it started.`;
  const solDetail = holdings.length > 0 && totalHoldingValue > 0
    ? "Holding most of a plan in one fund means its performance largely is your performance. That can be entirely appropriate for the mandate you're on — whether the split still suits you is a conversation for your next review."
    : `You've paid in $${Math.round(netContributed).toLocaleString()} and the account sits at $${Math.round(n(plan.latestAccountValue)).toLocaleString()}. Quarters like this are ordinary noise over a long term.`;

  return (
    <ClientAppShell>
      <div className="space-y-4 pb-8">
        <div>
          <Link
            href="/client/wealth/investments"
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-ink-40 hover:text-forest mb-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Portfolio
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-[34px] leading-[1.05] text-forest">
              {plan.nickname ?? plan.productName}
            </h1>
            <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold shrink-0", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="text-[14px] text-ink-40 mt-1">
            {plan.providerName}{plan.policyNumber ? ` · ${plan.policyNumber}` : ""}
          </p>
        </div>

        <SolNarration line={solLine} detail={solDetail} advisorFirstName={advisorFirstName} />

        {/* Cobalt account value hero */}
        <section aria-label="Account value" className="bg-forest text-paper rounded-[28px] p-5 flex flex-col gap-3">
          <p className="tala-eyebrow text-mint">
            Account value{plan.latestStatementDate ? ` · ${new Date(plan.latestStatementDate + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </p>
          <p className="font-display tabular-nums text-[52px] leading-none tracking-[-0.04em] text-paper">
            <CurrencyField amountUsd={n(plan.latestAccountValue)} currency={plan.currency} compact />
          </p>
          <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/20">
            <div>
              <div className="tala-eyebrow text-mint">Paid in</div>
              <div className="mt-1 text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={netContributed} currency={plan.currency} compact /></div>
            </div>
            <div>
              <div className="tala-eyebrow text-mint">Growth</div>
              <div className="mt-1 flex">
                <span className={cn("rounded-full px-2 py-0.5 text-[14px] font-semibold tabular-nums text-forest", isGain ? "bg-field" : "bg-sun")}>
                  <CurrencyField amountUsd={plan.gainLoss} currency={plan.currency} compact showSign />
                </span>
              </div>
            </div>
            <div>
              <div className="tala-eyebrow text-mint">Term left</div>
              <div className="mt-1 text-[16px] font-semibold text-paper tabular-nums">{term != null ? `${term} yrs` : "—"}</div>
            </div>
          </div>
        </section>

        <section aria-label="Funds" className="space-y-3">
          <h2 className="px-1 text-[16px] font-semibold text-forest">Funds</h2>
          {holdings.length === 0 ? (
            <p className="bg-surface rounded-[24px] p-5 text-[14px] text-ink-40">
              No fund data available — your advisor will update this after the next statement.
            </p>
          ) : (
            <div className="bg-surface rounded-[24px] p-1">
              {holdings.map((h, i) => {
                const val = n(h.finalValue);
                const pct = totalHoldingValue > 0 ? Math.round((val / totalHoldingValue) * 100) : 0;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => navigate(`/client/wealth/investments/${plan.id}/funds/${h.fundCode}`)}
                    className="w-full flex items-center gap-3 p-3 border-b border-hairline last:border-0 rounded-[20px] text-left hover:bg-paper/60 transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[11px] font-semibold", FUND_TILES[i % FUND_TILES.length])}
                    >
                      {h.fundCode.slice(0, 4)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-forest truncate">{h.fundName}</div>
                      <div className="text-[13px] text-ink-40">{h.fundCode}{h.unitsHeld ? ` · ${Number(h.unitsHeld).toLocaleString()} units` : ""}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-semibold text-forest tabular-nums"><CurrencyField amountUsd={val} currency={plan.currency} compact /></div>
                      <div className="text-[12px] text-ink-40 tabular-nums">{pct}% of plan</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-40 shrink-0" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section aria-label="Transactions" className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-[16px] font-semibold text-forest">Transactions</h2>
            {transactions.length > 0 && (
              <span className="text-[12px] font-semibold text-forest bg-surface rounded-full px-2.5 py-0.5 tabular-nums">
                {transactions.length}
              </span>
            )}
          </div>
          {txLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-12 bg-surface animate-pulse rounded-[14px]" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="bg-surface rounded-[24px] p-5 text-[14px] text-ink-40">
              Full transaction history will appear here once your advisor enters statement details.
            </p>
          ) : (
            <div className="bg-surface rounded-[24px] p-1">
              {groupedTx.map(group => (
                <div key={group.month}>
                  <p className="sticky top-0 bg-surface px-3 pt-3 pb-1 tala-eyebrow text-ink-40">
                    {group.month}
                  </p>
                  <div>
                    {group.rows.map(t => {
                      const amt = n(t.netAmount);
                      return (
                        <div key={t.id} className="flex items-center justify-between p-3 border-b border-hairline last:border-0">
                          <div className="min-w-0 pr-3">
                            <p className="text-[14px] font-medium text-forest truncate">{t.description}</p>
                            <p className="text-[13px] text-ink-40">
                              {new Date(t.transactionDate + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <span className={cn("text-[14px] font-semibold tabular-nums shrink-0", amt >= 0 ? "text-forest" : "text-clay-ink")}>
                            {amt >= 0 ? "+" : ""}
                            <CurrencyField amountUsd={amt} currency={plan.currency} compact />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex flex-col justify-between gap-4 text-left bg-breeze rounded-[24px] p-4 min-h-[132px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            <span className="w-9 h-9 rounded-full bg-forest text-paper flex items-center justify-center self-end" aria-hidden="true">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-forest">Statement history</span>
              <span className="block text-[13px] text-forest mt-0.5">All quarters, in detail</span>
            </span>
          </button>
          <Link
            href={`/client/goals/what-if?planId=${plan.id}`}
            className="flex flex-col justify-between gap-4 bg-field rounded-[24px] p-4 min-h-[132px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            <span className="w-9 h-9 rounded-full bg-forest text-paper flex items-center justify-center self-end" aria-hidden="true">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-forest">Run a what-if</span>
              <span className="block text-[13px] text-forest mt-0.5">On this plan</span>
            </span>
          </Link>
        </div>
      </div>

      <StatementHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        plan={plan}
        statements={statements}
        holdingsByStatement={holdingsMap}
      />
    </ClientAppShell>
  );
}
