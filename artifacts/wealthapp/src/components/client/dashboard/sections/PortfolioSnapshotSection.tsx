import { Link } from "wouter";
import { cn } from "@/lib/utils";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";

interface Props {
  totalValue: number;
  gainLoss: number;
  gainLossPct: number;
  cagr: number | null;
  isTrackA: boolean;
  displayCurrency: string;
}

function StatCard({ label, sub, children, className }: {
  label: string; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <Link href="/client/portfolio">
      <div className={cn(
        "bg-white border border-[#E2E8F0] border-l-[3px] border-l-[#1D9E75] rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow",
        className
      )}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B] mb-1">{label}</p>
        <div className="text-[22px] font-semibold">{children}</div>
        {sub && <p className="text-[13px] mt-0.5 text-[#64748B]">{sub}</p>}
      </div>
    </Link>
  );
}

export default function PortfolioSnapshotSection({ totalValue, gainLoss, gainLossPct, cagr, isTrackA }: Props) {
  const isGain = gainLoss >= 0;
  const isCagrPos = (cagr ?? 0) >= 0;

  if (totalValue === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] border-l-[3px] border-l-[#1D9E75] rounded-xl p-4">
        <p className="text-sm text-[#64748B]">No investments tracked yet.</p>
        <Link href="/client/portfolio">
          <p className="text-sm font-medium text-[#1D9E75] mt-1 hover:text-[#0F6E56]">
            Add your first investment →
          </p>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total portfolio" sub={isTrackA ? "Advised + self-managed" : "Self-managed"}>
          <span className="text-[#042C53]"><CurrencyDisplay amountUsd={totalValue} compact /></span>
        </StatCard>

        <StatCard label="Total gain / loss">
          <span className={cn(isGain ? "text-emerald-600" : "text-red-500")}>
            <CurrencyDisplay amountUsd={gainLoss} compact showSign />
          </span>
          <p className={cn("text-[13px] mt-0.5 font-medium", isGain ? "text-emerald-500" : "text-red-400")}>
            {gainLoss >= 0 ? "+" : ""}{gainLossPct.toFixed(1)}%
          </p>
        </StatCard>

        <StatCard label="CAGR" sub="Annualised return">
          {cagr === null ? (
            <div className="group relative inline-block">
              <span className="text-slate-300">--</span>
              <div className="absolute bottom-full left-0 mb-1 w-52 bg-[#042C53] text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal font-normal text-[13px]">
                Requires 90+ days of investment history.
              </div>
            </div>
          ) : (
            <span className={cn(isCagrPos ? "text-emerald-600" : "text-red-500")}>
              {isCagrPos ? "+" : ""}{cagr.toFixed(1)}%/yr
            </span>
          )}
        </StatCard>
      </div>

      <div className="flex justify-end">
        <Link href="/client/portfolio">
          <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">
            View full portfolio →
          </span>
        </Link>
      </div>
    </div>
  );
}
