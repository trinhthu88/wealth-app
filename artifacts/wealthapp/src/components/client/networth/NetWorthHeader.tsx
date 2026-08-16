import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import CurrencyToggle from "@/components/client/CurrencyToggle";
import { cn } from "@/lib/utils";

interface Props {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetCount: number;
  liabilityCount: number;
  trendDelta: number | null;
  loading: boolean;
}

function StatCard({
  label,
  valueUsd,
  sub,
  valueColor,
  loading,
}: {
  label: string;
  valueUsd: number;
  sub?: React.ReactNode;
  valueColor?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] border-l-4 border-l-[#1D9E75] rounded-xl p-4">
      <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide mb-1">{label}</p>
      {loading ? (
        <p className="text-xl font-bold text-slate-300">--</p>
      ) : (
        <p className={cn("text-xl font-bold text-[#042C53]", valueColor)}>
          <CurrencyDisplay amountUsd={valueUsd} compact />
        </p>
      )}
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

export default function NetWorthHeader({
  totalAssets, totalLiabilities, netWorth,
  assetCount, liabilityCount, trendDelta, loading,
}: Props) {
  const nwColor = netWorth > 0 ? "text-emerald-600" : netWorth < 0 ? "text-red-500" : undefined;

  let trendNode: React.ReactNode = null;
  if (trendDelta !== null && !loading) {
    const isUp = trendDelta >= 0;
    const Icon = trendDelta === 0 ? Minus : isUp ? TrendingUp : TrendingDown;
    trendNode = (
      <span className={cn("flex items-center gap-0.5 text-xs font-medium", isUp ? "text-emerald-600" : "text-red-500")}>
        <Icon className="h-3.5 w-3.5" />
        <CurrencyDisplay amountUsd={Math.abs(trendDelta)} compact showSign={false} />
        {" "}from last snapshot
      </span>
    );
  } else if (!loading) {
    trendNode = <span className="text-xs text-slate-400">First recorded today</span>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#042C53]">Net Worth</h1>
        <CurrencyToggle />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total assets"
          valueUsd={totalAssets}
          sub={<span className="text-xs text-slate-400">{assetCount} items</span>}
          loading={loading}
        />
        <StatCard
          label="Total liabilities"
          valueUsd={totalLiabilities}
          sub={<span className="text-xs text-slate-400">{liabilityCount} items</span>}
          valueColor={totalLiabilities > 0 ? "text-red-500" : undefined}
          loading={loading}
        />
        <StatCard
          label="Net worth"
          valueUsd={netWorth}
          sub={trendNode}
          valueColor={nwColor}
          loading={loading}
        />
      </div>
    </div>
  );
}
