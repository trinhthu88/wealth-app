import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  netWorth: number | null;
  deltaAbs: number | null;
  currency?: string;
  className?: string;
}

function fmt(n: number, currency: string) {
  const sym = currency === "VND" ? "₫" : "$";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sym}${Math.round(abs / 1000)}k`;
  return `${sym}${Math.round(abs).toLocaleString()}`;
}

export default function NetWorthDeltaCard({ netWorth, deltaAbs, currency = "USD", className }: Props) {
  if (netWorth === null) return null;
  const positive = (deltaAbs ?? 0) >= 0;

  return (
    <div className={cn("bg-surface rounded-[20px] p-[18px] shadow-[0_4px_14px_rgba(20,52,42,0.06)]", className)}>
      <p className="text-[11px] tracking-[0.11em] uppercase text-ink-40 mb-1">Net Worth</p>
      <div className="flex items-end gap-2.5 flex-wrap">
        <span className="font-display text-[26px] font-semibold text-forest tracking-[-0.01em]">
          {fmt(netWorth, currency)}
        </span>
        {deltaAbs !== null && deltaAbs !== 0 && (
          <span className={cn("flex items-center gap-1 text-[13px] font-semibold mb-0.5", positive ? "text-green" : "text-clay")}>
            {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {positive ? "+" : "-"}{fmt(deltaAbs, currency)} this month
          </span>
        )}
      </div>
    </div>
  );
}
