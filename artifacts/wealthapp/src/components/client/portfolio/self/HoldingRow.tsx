import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import CurrencyField from "@/components/shared/CurrencyField";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  holding: ClientHolding;
  onClick: () => void;
  onViewTx?: () => void;
  noBorder?: boolean;
}

// Leading tile colour by holding family.
const TILE_BY_TYPE: Record<string, string> = {
  stock_etf: "bg-forest text-paper",
  etf: "bg-forest text-paper",
  mutual_fund: "bg-forest text-paper",
  bond: "bg-field text-forest",
  commodity: "bg-field text-forest",
  crypto: "bg-breeze text-forest",
  property: "bg-breeze text-forest",
  cash: "bg-field text-forest",
  pension: "bg-breeze text-forest",
  other: "bg-paper text-forest",
};

function initialsFor(holding: ClientHolding) {
  const code = holding.ticker || holding.coinSymbol;
  if (code) return code.slice(0, 3).toUpperCase();
  const words = holding.label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export default function HoldingRow({ holding, onClick, onViewTx, noBorder }: Props) {
  const isGain = holding.gainLossPct >= 0;

  let subtitle = holding.holdingType.replace("_", " ");
  if (holding.ticker) {
    subtitle = holding.brokerPlatform ? `${holding.brokerPlatform} · ${holding.ticker}` : holding.ticker;
  } else if (holding.coinSymbol) {
    subtitle = holding.exchangeName ? `${holding.exchangeName} · ${holding.coinSymbol}` : holding.coinSymbol;
  } else if (holding.bankName) {
    subtitle = holding.bankName;
  } else if (holding.propertyAddress) {
    subtitle = holding.propertyAddress;
  }

  return (
    <div className={cn(
      "flex justify-between items-center gap-3 p-3",
      !noBorder && "border-b border-hairline"
    )}>
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 items-center gap-3 text-left min-w-0 group rounded-[14px]"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-11 w-11 flex-none items-center justify-center rounded-[14px] text-[12px] font-semibold",
            TILE_BY_TYPE[holding.holdingType] ?? "bg-paper text-forest",
          )}
        >
          {initialsFor(holding)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-forest truncate group-hover:underline">{holding.label}</span>
          <span className="text-[13px] text-ink-40 truncate capitalize">{subtitle}</span>
        </span>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {onViewTx && (
          <button
            type="button"
            onClick={onViewTx}
            className="w-11 h-11 rounded-full flex items-center justify-center text-ink-40 hover:bg-paper hover:text-forest transition-colors"
            aria-label="View transactions"
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <div className="flex flex-col items-end gap-1">
          <div className="text-[15px] font-semibold text-forest tabular-nums">
            <CurrencyField amountUsd={holding.currentValue} />
          </div>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums text-forest",
            isGain ? "bg-field" : "bg-sun",
          )}>
            {isGain ? "+" : ""}{holding.gainLossPct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
