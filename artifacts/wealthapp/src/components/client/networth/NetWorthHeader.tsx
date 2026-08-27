import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import CurrencyField from "@/components/shared/CurrencyField";
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
    <div className="bg-surface border border-hairline border-l-4 border-l-green rounded-[18px] p-4">
      <p className="text-xs font-medium text-ink-40 uppercase tracking-wide mb-1">{label}</p>
      {loading ? (
        <p className="text-xl font-bold text-ink-20">--</p>
      ) : (
        <p className={cn("font-display text-xl font-bold text-forest", valueColor)}>
          <CurrencyField amountUsd={valueUsd} compact />
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
  const nwColor = netWorth > 0 ? "text-green" : netWorth < 0 ? "text-clay" : undefined;

  let trendNode: React.ReactNode = null;
  if (trendDelta !== null && !loading) {
    const isUp = trendDelta >= 0;
    const Icon = trendDelta === 0 ? Minus : isUp ? TrendingUp : TrendingDown;
    trendNode = (
      <span className={cn("flex items-center gap-0.5 text-xs font-medium", isUp ? "text-green" : "text-clay")}>
        <Icon className="h-3.5 w-3.5" />
        <CurrencyField amountUsd={Math.abs(trendDelta)} compact showSign={false} />
        {" "}from last snapshot
      </span>
    );
  } else if (!loading) {
    trendNode = <span className="text-xs text-ink-30">First recorded today</span>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-forest">Net Worth</h1>
        <CurrencyToggle />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total assets"
          valueUsd={totalAssets}
          sub={<span className="text-xs text-ink-30">{assetCount} items</span>}
          loading={loading}
        />
        <StatCard
          label="Total liabilities"
          valueUsd={totalLiabilities}
          sub={<span className="text-xs text-ink-30">{liabilityCount} items</span>}
          valueColor={totalLiabilities > 0 ? "text-clay" : undefined}
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
