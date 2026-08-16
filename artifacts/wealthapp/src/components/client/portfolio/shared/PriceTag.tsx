import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  priceUsd: number;
  change1dPct: number;
  isStale: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function PriceTag({ priceUsd, change1dPct, isStale, onRefresh, refreshing }: Props) {
  const isPos = change1dPct >= 0;

  if (isStale) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <AlertTriangle className="h-3 w-3" />
        ${priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Price may be outdated
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="underline hover:no-underline ml-1"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      ${priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      <span className={cn("font-medium", isPos ? "text-emerald-600" : "text-red-500")}>
        {isPos ? "▲" : "▼"} {Math.abs(change1dPct).toFixed(2)}%
      </span>
    </span>
  );
}
