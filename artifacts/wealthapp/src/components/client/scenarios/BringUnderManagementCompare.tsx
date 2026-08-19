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
      <div className="bg-white border border-[#E6E1D8] rounded-[24px] p-8 text-center text-[#6B6459] text-sm">
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
                "min-h-[36px] px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors",
                selectedId === h.id
                  ? "border-[#1D9E75] bg-[#E6F5EE] text-[#0F6E56]"
                  : "border-[#E6E1D8] bg-white text-[#6B6459] hover:text-[#042C53]"
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      )}

      {selected && (benchmarkLoading || !benchmark) ? (
        <div className="h-64 bg-[#E6E1D8]/30 rounded-[24px] animate-pulse" />
      ) : selected && benchmark && projection ? (
        <div className="space-y-3.5">
          <div>
            <Link href="/client/portfolio">
              <span className="text-[13px] font-semibold text-[#1D9E75] cursor-pointer hover:underline mb-1 inline-block">
                ← Accounts
              </span>
            </Link>
            <h2 className="font-display text-[22px] font-bold text-[#042C53] tracking-[-0.02em] mb-1">
              {selected.label}, two ways
            </h2>
            <p className="text-[13px] leading-[1.5] text-[#6B6459] text-pretty">
              You track this holding yourself at {projection.asIsReturn.toFixed(1)}%. Below, the same ${Math.round(selected.currentValue).toLocaleString()} under the benchmark rate and under advisor management, both to {new Date().getFullYear() + HORIZON_YEARS}.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-white border border-[#E6E1D8] rounded-[20px] p-4">
              <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-[#6B6459] mb-2.5">Left as-is</div>
              <svg width="100%" height="72" viewBox="0 0 140 72" preserveAspectRatio="none" className="block mb-3">
                <path d="M0,68 Q80,60 140,30" fill="none" stroke="#4A7CB8" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M0,68 Q80,60 140,30 L140,72 L0,72 Z" fill="#4A7CB8" opacity=".08" />
              </svg>
              <div className="font-display text-[19px] font-bold text-[#042C53] tracking-[-0.02em]">
                ${Math.round(projection.asIsFinal).toLocaleString()}
              </div>
              <div className="text-[11px] text-[#6B6459] mt-1 leading-[1.45]">
                in {new Date().getFullYear() + HORIZON_YEARS}, assuming <strong className="text-[#042C53] font-semibold">{projection.asIsReturn.toFixed(1)}% p.a.</strong> before fees and tax
              </div>
            </div>

            <div className="flex-1 bg-white border-[1.5px] border-[#1D9E75] rounded-[20px] p-4 shadow-[0_4px_14px_rgba(29,158,117,.12)]">
              <div className="font-mono text-[9px] tracking-[0.12em] uppercase text-[#0F6E56] mb-2.5">Under advisor management</div>
              <svg width="100%" height="72" viewBox="0 0 140 72" preserveAspectRatio="none" className="block mb-3">
                <path d="M0,68 Q80,52 140,8" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M0,68 Q80,52 140,8 L140,72 L0,72 Z" fill="#1D9E75" opacity=".10" />
              </svg>
              <div className="font-display text-[19px] font-bold text-[#0F6E56] tracking-[-0.02em]">
                {projection.managedFinal != null ? `$${Math.round(projection.managedFinal).toLocaleString()}` : "N/A"}
              </div>
              <div className="text-[11px] text-[#6B6459] mt-1 leading-[1.45]">
                in {new Date().getFullYear() + HORIZON_YEARS}, assuming <strong className="text-[#042C53] font-semibold">{projection.managedReturn?.toFixed(1)}% p.a.</strong> net of a 0.9% advice fee
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E6E1D8] rounded-[20px] p-4.5">
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B6459] mb-3">What sits behind these numbers</div>
            <div className="flex justify-between items-center text-xs text-[#2D2A24] py-2 border-b border-[#F2EFE9]">
              <span>Starting value</span>
              <span className="font-mono">${Math.round(selected.currentValue).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-[#2D2A24] py-2 border-b border-[#F2EFE9]">
              <span>Horizon</span>
              <span className="font-mono">{HORIZON_YEARS} years</span>
            </div>
            <div className="flex justify-between items-center text-xs text-[#2D2A24] py-2 border-b border-[#F2EFE9]">
              <span>Further contributions</span>
              <span className="font-mono">None assumed</span>
            </div>
            <div className="flex justify-between items-center text-xs text-[#2D2A24] py-2">
              <span>Inflation adjustment</span>
              <span className="font-mono">Not applied</span>
            </div>
          </div>

          <div className="bg-[#F2EFE9] rounded-[16px] p-3.5 px-4">
            <div className="text-[11px] leading-[1.55] text-[#6B6459] text-pretty">
              <strong className="text-[#042C53]">Not a guarantee.</strong> Both figures are illustrations based on the assumptions above. Actual returns will differ, and the advised trajectory is not a promise of outperformance. Past performance does not predict future results.
            </div>
          </div>

          <Link href={`/client/messages?about=${encodeURIComponent(`bringing my ${selected.label} under management`)}`}>
            <button className="w-full min-h-[48px] border-none rounded-[16px] bg-[#1D9E75] text-white font-sans text-sm font-semibold cursor-pointer hover:bg-[#17805F] transition-colors">
              Ask advisor about this
            </button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
