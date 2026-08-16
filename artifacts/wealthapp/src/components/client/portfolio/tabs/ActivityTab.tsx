import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import StatementDetailView from "@/components/client/portfolio/advised/StatementDetailView";
import HoldingTypeBadge from "@/components/client/HoldingTypeBadge";
import { cn } from "@/lib/utils";
import type { AdvisedPlan, AdvisedPlanStatement, AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";
import type { ClientHolding } from "@/hooks/useClientHoldings";
import { useQueryClient } from "@tanstack/react-query";

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

interface PlanStatements {
  planId: string;
  planName: string;
  statements: AdvisedPlanStatement[];
  holdings: Record<string, AdvisedPlanHolding[]>;
}

interface Props {
  plans: AdvisedPlan[];
  selfHoldings: ClientHolding[];
}

function PlanActivitySection({ plan }: { plan: AdvisedPlan }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: statements = [] } = useQuery<AdvisedPlanStatement[]>({
    queryKey: ["activity-statements", plan.id],
    queryFn: () => apiFetch(`/client/advised-plans/${plan.id}/statements`),
  });

  const { data: holdingsMap = {} } = useQuery<Record<string, AdvisedPlanHolding[]>>({
    queryKey: ["activity-holdings", plan.id, statements.map(s => s.id).join(",")],
    queryFn: async () => {
      const map: Record<string, AdvisedPlanHolding[]> = {};
      for (const stmt of statements) {
        const h = await apiFetch<AdvisedPlanHolding[]>(`/client/advised-plans/${plan.id}/statements/${stmt.id}/holdings`);
        map[stmt.id] = h;
      }
      return map;
    },
    enabled: statements.length > 0,
  });

  const sorted = [...statements].sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime());

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-[#042C53]">{plan.nickname ?? plan.productName}</p>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400 py-3">No statements yet.</p>
      ) : (
        sorted.map(stmt => {
          const returns = n(stmt.investmentReturns);
          const isPos = returns >= 0;
          const isExp = expanded === stmt.id;
          const period = `${new Date(stmt.periodStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${new Date(stmt.periodEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

          return (
            <div key={stmt.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                onClick={() => setExpanded(isExp ? null : stmt.id)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#042C53]">{period}</p>
                  <p className="text-xs text-slate-400">Closing: ${n(stmt.closingValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn("text-sm font-medium tabular-nums", isPos ? "text-emerald-600" : "text-red-500")}>
                    {isPos ? "+" : "−"}${Math.abs(returns).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-slate-300 text-sm">{isExp ? "▲" : "▾"}</span>
                </div>
              </button>
              {isExp && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                  <StatementDetailView statement={stmt} holdings={holdingsMap[stmt.id] ?? []} />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function ActivityTab({ plans, selfHoldings }: Props) {
  const qc = useQueryClient();
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const TICKER_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);
  const priceHoldings = selfHoldings.filter(h => TICKER_TYPES.has(h.holdingType) || h.holdingType === "crypto");

  async function refreshSingle(h: ClientHolding) {
    const sym = h.holdingType === "crypto" ? h.coinSymbol : h.ticker;
    if (!sym) return;
    setRefreshingId(h.id);
    try {
      const ep = h.holdingType === "crypto" ? `/prices/crypto/${sym}` : `/prices/stock/${encodeURIComponent(sym)}`;
      await apiFetch(ep);
      qc.invalidateQueries({ queryKey: ["client-holdings-raw"] });
    } finally { setRefreshingId(null); }
  }

  async function refreshAll() {
    setRefreshingAll(true);
    try {
      const stocks = priceHoldings.filter(h => TICKER_TYPES.has(h.holdingType)).map(h => h.ticker ?? "").filter(Boolean);
      const cryptos = priceHoldings.filter(h => h.holdingType === "crypto").map(h => h.coinSymbol ?? "").filter(Boolean);
      await apiFetch("/prices/batch", { method: "POST", body: JSON.stringify({ stocks, cryptos }) });
      qc.invalidateQueries({ queryKey: ["client-holdings-raw"] });
    } finally { setRefreshingAll(false); }
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Statements */}
      {plans.length > 0 && (
        <div className="space-y-4">
          <p className="text-base font-semibold text-[#042C53]">Quarterly statements</p>
          {plans.map(plan => <PlanActivitySection key={plan.id} plan={plan} />)}
        </div>
      )}

      {/* Section 2: Price updates */}
      {priceHoldings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-[#042C53]">Price updates</p>
              <p className="text-xs text-slate-400">Prices for stocks, ETFs and crypto refresh automatically.</p>
            </div>
            <button
              onClick={refreshAll}
              disabled={refreshingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshingAll && "animate-spin")} />
              {refreshingAll ? "Refreshing…" : "Refresh all"}
            </button>
          </div>
          <div className="space-y-2">
            {priceHoldings.map(h => {
              const sym = h.holdingType === "crypto" ? h.coinSymbol : h.ticker;
              return (
                <div key={h.id} className="flex items-center justify-between px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <HoldingTypeBadge type={h.holdingType} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-[#042C53]">{sym} · {h.label}</p>
                      <p className="text-xs text-slate-400">
                        ${h.currentPriceUsd?.toFixed(2) ?? "—"}
                        {h.isPriceStale && " · ⚠ may be outdated"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => refreshSingle(h)}
                    disabled={refreshingId === h.id}
                    className="flex items-center gap-1 text-xs text-[#1D9E75] hover:text-[#0F6E56] font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshingId === h.id && "animate-spin")} />
                    Refresh
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
