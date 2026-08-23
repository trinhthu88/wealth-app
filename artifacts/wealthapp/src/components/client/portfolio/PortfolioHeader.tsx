import { cn } from "@/lib/utils";
import CurrencyField from "@/components/shared/CurrencyField";
import CurrencyToggle from "@/components/client/CurrencyToggle";
import type { usePortfolioTotals } from "@/hooks/usePortfolioTotals";

interface Props {
  totals: ReturnType<typeof usePortfolioTotals>;
  loading: boolean;
}

function MetricCard({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-[#E2E8F0] rounded-xl p-4", className)}>
      <p className="text-xs text-[#64748B] mb-1">{label}</p>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 h-[72px] animate-pulse bg-slate-100" />;
}

export default function PortfolioHeader({ totals, loading }: Props) {
  const { totalPortfolioValue, totalNetContribution, totalGainLoss, totalGainLossPct, overallCagr } = totals;
  const isGain = totalGainLoss >= 0;
  const isCagrPos = (overallCagr ?? 0) >= 0;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="h-8 w-48 bg-slate-100 animate-pulse rounded-lg ml-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total portfolio">
          <p className="text-2xl font-semibold text-[#042C53]">
            <CurrencyField amountUsd={totalPortfolioValue} compact />
          </p>
        </MetricCard>

        <MetricCard label="Total invested">
          <p className="text-2xl font-semibold text-[#042C53]">
            <CurrencyField amountUsd={totalNetContribution} compact />
          </p>
        </MetricCard>

        <MetricCard label="Total gain / loss">
          <p className={cn("text-2xl font-semibold", isGain ? "text-emerald-600" : "text-red-500")}>
            <CurrencyField amountUsd={totalGainLoss} compact showSign />
          </p>
          <p className={cn("text-[13px] mt-0.5 font-medium", isGain ? "text-emerald-600" : "text-red-500")}>
            {isGain ? "+" : ""}{totalGainLossPct.toFixed(1)}%
          </p>
        </MetricCard>

        <MetricCard label="CAGR" className="hidden md:block">
          {overallCagr === null ? (
            <div className="group relative inline-block">
              <p className="text-2xl font-semibold text-slate-400">--</p>
              <div className="absolute bottom-full left-0 mb-1 w-56 bg-[#042C53] text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                CAGR requires at least one holding with 90+ days of history.
              </div>
            </div>
          ) : (
            <p className={cn("text-2xl font-semibold", isCagrPos ? "text-emerald-600" : "text-red-500")}>
              {isCagrPos ? "+" : ""}{overallCagr.toFixed(1)}%/yr
            </p>
          )}
        </MetricCard>
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-[#64748B]">Displaying in:</span>
        <CurrencyToggle />
      </div>
    </div>
  );
}
