import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import CurrencyField from "@/components/shared/CurrencyField";
import StatementHistoryDrawer from "@/components/client/portfolio/advised/StatementHistoryDrawer";
import { formatPct } from "@/lib/currencyUtils";
import { apiFetch } from "@/lib/api";
import { useAdvisedPlans, useAdvisedPlanTransactions, type AdvisedPlanStatement, type AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  inforce:   { label: "In force",    className: "bg-green-tint text-green" },
  matured:   { label: "Paid up",     className: "bg-sun-tint text-amber-ink" },
  surrender: { label: "Lapsed",      className: "bg-clay-tint text-clay-ink" },
  scenario:  { label: "Scenario",    className: "bg-hairline text-ink-40" },
};

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

function monthKey(dateStr: string) {
  const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function AdvisedPlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const { plans, loading: plansLoading } = useAdvisedPlans();
  const { transactions, loading: txLoading } = useAdvisedPlanTransactions(planId ?? null);
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

  const holdings = [...(plan.latestHoldings ?? [])].sort((a, b) => n(b.finalValue) - n(a.finalValue));
  const totalHoldingValue = holdings.reduce((s, h) => s + n(h.finalValue), 0);

  const groupedTx: { month: string; rows: typeof transactions }[] = [];
  for (const t of transactions) {
    const key = monthKey(t.transactionDate);
    const group = groupedTx[groupedTx.length - 1];
    if (group && group.month === key) group.rows.push(t);
    else groupedTx.push({ month: key, rows: [t] });
  }

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

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] text-ink-40 mb-1">Account value</p>
              <p className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none">
                <CurrencyField amountUsd={n(plan.latestAccountValue)} currency={plan.currency} compact />
              </p>
            </div>
            <div>
              <p className="text-[13px] text-ink-40 mb-1">Net contributed</p>
              <p className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none">
                <CurrencyField amountUsd={n(plan.latestNetContribution)} currency={plan.currency} compact />
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-hairline">
            <div>
              <p className="text-[13px] text-ink-40 mb-1">Gain / loss</p>
              <p className={cn("text-[16px] font-semibold tabular-nums", isGain ? "text-green" : "text-clay")}>
                <CurrencyField amountUsd={plan.gainLoss} currency={plan.currency} compact showSign /> ({formatPct(plan.gainLossPct)})
              </p>
            </div>
            {plan.effectiveDate && (
              <div className="text-right">
                <p className="text-[13px] text-ink-40 mb-1">CAGR</p>
                <p className={cn("text-[16px] font-semibold tabular-nums", plan.cagr >= 0 ? "text-green" : "text-clay")}>
                  {formatPct(plan.cagr)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface rounded-[26px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <p className="text-[15px] font-semibold text-forest mb-3">Fund allocation</p>
          {holdings.length === 0 ? (
            <p className="text-[13.5px] text-ink-40 py-2">
              No fund data available — your advisor will update this after the next statement.
            </p>
          ) : (
            <div className="space-y-3">
              {holdings.map(h => {
                const val = n(h.finalValue);
                const pct = totalHoldingValue > 0 ? (val / totalHoldingValue) * 100 : 0;
                return (
                  <div key={h.id}>
                    <div className="flex items-center justify-between text-[13.5px] mb-1">
                      <span className="text-forest font-medium truncate pr-2">{h.fundName}</span>
                      <span className="text-forest font-semibold tabular-nums shrink-0">
                        <CurrencyField amountUsd={val} currency={plan.currency} compact />
                      </span>
                    </div>
                    <div className="h-[4px] w-full rounded-full bg-hairline overflow-hidden">
                      <div className="h-full rounded-full bg-green" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
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

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="w-full min-h-11 rounded-[14px] border border-hairline text-[13.5px] font-semibold text-green hover:bg-green-tint transition-colors"
        >
          View full statement history
        </button>
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
