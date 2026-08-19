import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
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

const HORIZON_YEARS = 12;

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
      <div className="bg-surface border border-hairline rounded-[26px] p-8 text-center text-ink-60 text-[14px]">
        No self-tracked holdings to compare yet. Add one from Investment accounts.
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {eligible.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
          {eligible.map(h => (
            <button
              key={h.id}
              onClick={() => setSelectedId(h.id)}
              className={cn(
                "min-h-[36px] px-3.5 rounded-full border text-[13px] font-semibold whitespace-nowrap transition-colors",
                selectedId === h.id
                  ? "border-green bg-green-tint text-forest"
                  : "border-hairline bg-surface text-ink-40 hover:text-forest"
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      )}

      {selected && (benchmarkLoading || !benchmark) ? (
        <div className="h-64 bg-surface rounded-[26px] animate-pulse" />
      ) : selected && benchmark && projection ? (
        <div className="space-y-[14px]">
          <div>
            <Link href="/client/portfolio">
              <span className="text-[13px] font-semibold text-green cursor-pointer hover:underline mb-1 inline-block">
                ← Accounts
              </span>
            </Link>
            <h2 className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em] mb-1">
              {selected.label}, two ways
            </h2>
            <p className="text-[13px] leading-[1.5] text-ink-60 text-pretty">
              You track this holding yourself at {projection.asIsReturn.toFixed(1)}%. Below, the same ${Math.round(selected.currentValue).toLocaleString()} under the benchmark rate and under advisor management, both to {new Date().getFullYear() + HORIZON_YEARS}.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-surface border border-hairline rounded-[24px] p-4">
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-40 mb-2.5">Left as-is</div>
              <svg width="100%" height="72" viewBox="0 0 140 72" preserveAspectRatio="none" className="block mb-3">
                <path d="M0,68 Q80,60 140,30" fill="none" stroke="var(--green-300)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M0,68 Q80,60 140,30 L140,72 L0,72 Z" fill="var(--green-300)" opacity=".08" />
              </svg>
              <div className="font-display text-[19px] font-bold text-forest tracking-[-0.02em]">
                ${Math.round(projection.asIsFinal).toLocaleString()}
              </div>
              <div className="text-[11px] text-ink-40 mt-1 leading-[1.45]">
                in {new Date().getFullYear() + HORIZON_YEARS}, assuming <strong className="text-forest font-semibold">{projection.asIsReturn.toFixed(1)}% p.a.</strong> before fees and tax
              </div>
            </div>

            <div className="flex-1 bg-surface border-[1.5px] border-green rounded-[24px] p-4 shadow-[0_4px_14px_rgba(29,158,117,.12)]">
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-green mb-2.5">Under advisor management</div>
              <svg width="100%" height="72" viewBox="0 0 140 72" preserveAspectRatio="none" className="block mb-3">
                <path d="M0,68 Q80,52 140,8" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M0,68 Q80,52 140,8 L140,72 L0,72 Z" fill="var(--green)" opacity=".10" />
              </svg>
              <div className="font-display text-[19px] font-bold text-green tracking-[-0.02em]">
                {projection.managedFinal != null ? `$${Math.round(projection.managedFinal).toLocaleString()}` : "N/A"}
              </div>
              <div className="text-[11px] text-ink-40 mt-1 leading-[1.45]">
                in {new Date().getFullYear() + HORIZON_YEARS}, assuming <strong className="text-forest font-semibold">{projection.managedReturn?.toFixed(1)}% p.a.</strong> net of a 0.9% advice fee
              </div>
            </div>
          </div>

          <div className="bg-surface border border-hairline rounded-[24px] p-[18px]">
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-40 mb-3">What sits behind these numbers</div>
            <div className="flex justify-between items-center text-[13px] text-forest py-2 border-b border-hairline">
              <span>Starting value</span>
              <span className="font-mono">${Math.round(selected.currentValue).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-forest py-2 border-b border-hairline">
              <span>Horizon</span>
              <span className="font-mono">{HORIZON_YEARS} years</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-forest py-2 border-b border-hairline">
              <span>Further contributions</span>
              <span className="font-mono">None assumed</span>
            </div>
            <div className="flex justify-between items-center text-[13px] text-forest py-2">
              <span>Inflation adjustment</span>
              <span className="font-mono">Not applied</span>
            </div>
          </div>

          <div className="bg-paper rounded-[16px] p-[14px]">
            <div className="text-[11px] leading-[1.55] text-ink-40 text-pretty">
              <strong className="text-forest font-semibold">Not a guarantee.</strong> Both figures are illustrations based on the assumptions above. Actual returns will differ, and the advised trajectory is not a promise of outperformance. Past performance does not predict future results.
            </div>
          </div>

          <Link href={`/client/messages?about=${encodeURIComponent(`bringing my ${selected.label} under management`)}`}>
            <button className="w-full min-h-[48px] border-none rounded-[16px] bg-green text-white font-sans text-[14.5px] font-semibold cursor-pointer hover:bg-forest-700 transition-colors">
              Ask advisor about this
            </button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
