import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  inforce:   { label: "In force",    className: "bg-green-tint text-green" },
  matured:   { label: "Paid up",     className: "bg-sun-tint text-amber-ink" },
  surrender: { label: "Lapsed",      className: "bg-clay-tint text-clay-ink" },
  scenario:  { label: "Scenario",    className: "bg-hairline text-ink-40" },
};

const FUND_COLORS = ["var(--green)", "var(--forest)", "var(--green-300)", "var(--sun)", "var(--sand)"];

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
          <div className="h-40 bg-surface animate-pulse rounded-[26px]" />
        </div>
      </ClientAppShell>
    );
  }

  if (!plan) {
    return (
      <ClientAppShell>
        <div className="text-center py-16">
          <p className="text-[15px] text-ink-40 mb-4">This plan could not be found.</p>
          <Link href="/client/portfolio" className="text-[14px] font-semibold text-green">Back to Portfolio</Link>
        </div>
      </ClientAppShell>
    );
  }

  const status = STATUS_CONFIG[plan.status] ?? { label: plan.status, className: "bg-hairline text-ink-40" };
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
            href="/client/portfolio"
            className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink-40 hover:text-forest mb-3"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Portfolio
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em]">
              {plan.nickname ?? plan.productName}
            </h1>
            <span className={cn("text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-md shrink-0", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="text-[13.5px] text-ink-40 mt-0.5">
            {plan.providerName}{plan.policyNumber ? ` · ${plan.policyNumber}` : ""}
          </p>
        </div>

        <SolNarration line={solLine} detail={solDetail} advisorFirstName={advisorFirstName} />

        {/* Dark account value hero */}
        <div className="bg-forest rounded-[28px] p-[22px]">
          <p className="text-[12.5px] font-semibold text-mint">
            Account value{plan.latestStatementDate ? ` · ${new Date(plan.latestStatementDate + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </p>
          <p className="font-display text-[40px] font-semibold text-paper tracking-[-0.03em] tabular-nums my-0.5 mb-3">
            <CurrencyField amountUsd={n(plan.latestAccountValue)} currency={plan.currency} compact />
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <div className="text-[11.5px] text-mint">Paid in</div>
              <div className="text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={netContributed} currency={plan.currency} compact /></div>
            </div>
            <div>
              <div className="text-[11.5px] text-mint">Growth</div>
              <div className={cn("text-[16px] font-semibold tabular-nums", isGain ? "text-sun" : "text-clay")}>
                <CurrencyField amountUsd={plan.gainLoss} currency={plan.currency} compact showSign />
              </div>
            </div>
            <div>
              <div className="text-[11.5px] text-mint">Term left</div>
              <div className="text-[16px] font-semibold text-paper tabular-nums">{term != null ? `${term} yrs` : "—"}</div>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <p className="text-[15px] font-semibold text-forest mb-3">Funds</p>
          {holdings.length === 0 ? (
            <p className="text-[13.5px] text-ink-40 py-2">
              No fund data available — your advisor will update this after the next statement.
            </p>
          ) : (
            <div>
              {holdings.map((h, i) => {
                const val = n(h.finalValue);
                const pct = totalHoldingValue > 0 ? Math.round((val / totalHoldingValue) * 100) : 0;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => navigate(`/client/portfolio/${plan.id}/funds/${h.fundCode}`)}
                    className="w-full flex items-center gap-3 py-[11px] border-t border-hairline first:border-t-0 text-left hover:bg-hairline/20 transition-colors"
                  >
                    <span className="w-[10px] h-[34px] rounded-[4px] shrink-0" style={{ background: FUND_COLORS[i % FUND_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14.5px] font-semibold text-forest truncate">{h.fundName}</div>
                      <div className="text-[12.5px] text-ink-40">{h.fundCode}{h.unitsHeld ? ` · ${Number(h.unitsHeld).toLocaleString()} units` : ""}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-semibold text-forest tabular-nums"><CurrencyField amountUsd={val} currency={plan.currency} compact /></div>
                      <div className="text-[12px] text-ink-30">{pct}% of plan</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-30 shrink-0" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[15px] font-semibold text-forest">Transactions</p>
            {transactions.length > 0 && (
              <span className="text-[11px] font-semibold text-ink-40 bg-hairline rounded-full px-2 py-0.5">
                {transactions.length}
              </span>
            )}
          </div>
          {txLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-10 bg-hairline/60 animate-pulse rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-[13.5px] text-ink-40 py-2">
              Full transaction history will appear here once your advisor enters statement details.
            </p>
          ) : (
            <div>
              {groupedTx.map(group => (
                <div key={group.month}>
                  <p className="sticky top-0 bg-surface py-1.5 text-[11.5px] font-semibold text-ink-40 uppercase tracking-wide">
                    {group.month}
                  </p>
                  <div>
                    {group.rows.map(t => {
                      const amt = n(t.netAmount);
                      return (
                        <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-hairline last:border-0">
                          <div className="min-w-0 pr-3">
                            <p className="text-[13.5px] text-forest truncate">{t.description}</p>
                            <p className="text-[12px] text-ink-40">
                              {new Date(t.transactionDate + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <span className={cn("text-[13.5px] font-semibold tabular-nums shrink-0", amt >= 0 ? "text-green" : "text-clay")}>
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="text-left bg-surface rounded-[20px] p-[16px] shadow-[0_2px_14px_rgba(20,52,42,.06)]"
          >
            <div className="text-[14px] font-semibold text-forest">Statement history</div>
            <div className="text-[12.5px] text-ink-40 mt-0.5">All quarters, in detail</div>
          </button>
          <Link
            href={`/client/scenarios?planId=${plan.id}`}
            className="bg-sun-tint rounded-[20px] p-[16px] block"
          >
            <div className="text-[14px] font-semibold text-amber-ink">Run a what-if</div>
            <div className="text-[12.5px] text-[#B07A22] mt-0.5">On this plan</div>
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
