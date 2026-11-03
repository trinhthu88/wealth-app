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

function StatCell({
  label,
  valueUsd,
  sub,
  loading,
}: {
  label: string;
  valueUsd: number;
  sub?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="bg-white/10 rounded-[18px] p-3.5 min-w-0">
      <p className="tala-eyebrow text-mint mb-1.5">{label}</p>
      {loading ? (
        <p className="text-[18px] font-semibold text-mint">--</p>
      ) : (
        <p className="text-[18px] font-semibold tabular-nums text-paper truncate">
          <CurrencyField amountUsd={valueUsd} compact />
        </p>
      )}
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

export default function NetWorthHeader({
  totalAssets, totalLiabilities, netWorth,
  assetCount, liabilityCount, trendDelta, loading,
}: Props) {
  const nwColor = netWorth < 0 ? "text-sun" : "text-paper";

  let trendNode: React.ReactNode = null;
  if (trendDelta !== null && !loading) {
    const isUp = trendDelta >= 0;
    const Icon = trendDelta === 0 ? Minus : isUp ? TrendingUp : TrendingDown;
    trendNode = (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-forest",
          isUp ? "bg-field" : "bg-sun"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <CurrencyField amountUsd={Math.abs(trendDelta)} compact showSign={false} />
        {" "}from last snapshot
      </span>
    );
  } else if (!loading) {
    trendNode = <span className="text-[13px] text-mint">First recorded today</span>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[34px] leading-[1.05] text-forest">Net Worth</h1>
        <CurrencyToggle />
      </div>

      <div className="bg-forest text-paper rounded-[28px] p-5 space-y-4">
        <div className="space-y-3">
          <p className="tala-eyebrow text-mint">Net worth</p>
          {loading ? (
            <p className="font-display tabular-nums text-[56px] leading-none tracking-[-0.04em] text-mint">--</p>
          ) : (
            <p className={cn("font-display tabular-nums text-[48px] sm:text-[56px] leading-none tracking-[-0.04em]", nwColor)}>
              <CurrencyField amountUsd={netWorth} compact />
            </p>
          )}
          {trendNode && <div>{trendNode}</div>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCell
            label="Total assets"
            valueUsd={totalAssets}
            sub={<span className="text-[12px] text-mint">{assetCount} items</span>}
            loading={loading}
          />
          <StatCell
            label="Total liabilities"
            valueUsd={totalLiabilities}
            sub={<span className="text-[12px] text-mint">{liabilityCount} items</span>}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
