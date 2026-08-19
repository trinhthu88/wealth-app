import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { projectMonthlyGrowth } from "@/lib/investmentCalculations";
import { cn } from "@/lib/utils";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface BenchmarkResult {
  value: number;
  source: string;
  isOverride: boolean;
  benchmarkValue: number | null;
  benchmarkLabel: string | null;
  deviation: { deltaPoints: number; isOptimistic: boolean } | null;
}

interface StrategyReturn {
  id: string;
  planType: string;
  label: string;
  targetAnnualReturnPct: string;
}

const HORIZON_YEARS = 10;

// Self-tracked holdings that don't carry a market-driven value worth projecting
// (cash still has a rate, so it's included; everything else needs a current value > 0).
const ELIGIBLE_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond", "crypto", "property", "cash", "pension", "other"]);

export default function BringUnderManagementCompare({ holdings }: { holdings: ClientHolding[] }) {
  const eligible = holdings.filter(h => ELIGIBLE_TYPES.has(h.holdingType) && h.currentValue > 0);
  const [selectedId, setSelectedId] = useState<string | null>(eligible[0]?.id ?? null);
  const selected = eligible.find(h => h.id === selectedId) ?? null;

  const { data: strategyReturns = [] } = useQuery<StrategyReturn[]>({
    queryKey: ["advised-strategy-returns"],
    queryFn: () => apiFetch("/client/advised-strategy-returns"),
  });
  const targetStrategy = strategyReturns.find(s => s.planType === "rsp") ?? strategyReturns[0] ?? null;

  const { data: benchmark, isLoading: benchmarkLoading } = useQuery<BenchmarkResult>({
    queryKey: ["holding-benchmark", selected?.id],
    queryFn: () => apiFetch(`/client/holdings/${selected!.id}/benchmark`),
    enabled: !!selected,
  });

  const projection = useMemo(() => {
    if (!selected || !benchmark) return null;
    const months = HORIZON_YEARS * 12;
    const asIs = projectMonthlyGrowth(selected.currentValue, 0, benchmark.value, months);
    const target = targetStrategy ? parseFloat(targetStrategy.targetAnnualReturnPct) : null;
    const managed = target != null ? projectMonthlyGrowth(selected.currentValue, 0, target, months) : null;
    return {
      asIsFinal: asIs[asIs.length - 1].value,
      managedFinal: managed ? managed[managed.length - 1].value : null,
      asIsReturn: benchmark.value,
      managedReturn: target,
    };
  }, [selected, benchmark, targetStrategy]);

  if (eligible.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center">
        <p className="text-sm text-slate-400">No self-tracked holdings to compare yet. Add one from Investment accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Which holding?</p>
        <div className="flex flex-wrap gap-1.5">
          {eligible.map(h => (
            <button
              key={h.id}
              onClick={() => setSelectedId(h.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl border text-sm transition-all",
                selectedId === h.id
                  ? "border-[#1D9E75] bg-[#1D9E75]/5 text-[#042C53] font-medium"
                  : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/30"
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {selected && (benchmarkLoading || !benchmark) ? (
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
      ) : selected && benchmark && projection ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-500">Left as-is</p>
              <p className="text-2xl font-bold text-[#042C53]">{fmtCurrency(projection.asIsFinal)}</p>
              <p className="text-xs text-slate-400">
                in {HORIZON_YEARS} years, assumes {projection.asIsReturn.toFixed(1)}% annual return
                {benchmark.benchmarkLabel && !benchmark.isOverride ? ` (${benchmark.benchmarkLabel})` : benchmark.isOverride ? " (your estimate)" : ""}
              </p>
            </div>

            <div className="bg-[#1D9E75]/5 border border-[#1D9E75]/30 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-[#1D9E75]">If brought under management</p>
              {projection.managedFinal != null ? (
                <>
                  <p className="text-2xl font-bold text-[#042C53]">{fmtCurrency(projection.managedFinal)}</p>
                  <p className="text-xs text-slate-500">
                    in {HORIZON_YEARS} years, assumes {projection.managedReturn?.toFixed(1)}% annual return
                    {targetStrategy ? ` (${targetStrategy.label})` : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No target strategy configured yet — ask your advisor.</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
            <p>Illustrative only, based on the stated assumptions. Not a guarantee of future performance.</p>
          </div>

          <Link
            href={`/client/messages?about=${encodeURIComponent(`bringing my ${selected.label} under management`)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56] transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Ask your advisor about this →
          </Link>
        </>
      ) : null}
    </div>
  );
}
