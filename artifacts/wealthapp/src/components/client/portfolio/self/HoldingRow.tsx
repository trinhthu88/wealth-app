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
      "flex justify-between items-center py-[15px]",
      !noBorder && "border-b border-hairline"
    )}>
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-left min-w-0 pr-4 group"
      >
        <div className="text-[15px] font-semibold text-forest truncate group-hover:text-green transition-colors">{holding.label}</div>
        <div className="text-[13px] text-ink-30 truncate capitalize">{subtitle}</div>
      </button>
      
      <div className="flex items-center gap-3 shrink-0">
        {onViewTx && (
          <button
            type="button"
            onClick={onViewTx}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-30 hover:bg-hairline hover:text-forest transition-colors"
            aria-label="View transactions"
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <div className="text-right">
          <div className="text-[15px] font-semibold text-forest tabular-nums">
            <CurrencyField amountUsd={holding.currentValue} />
          </div>
          <div className={cn("text-[13px] font-semibold", isGain ? "text-green" : "text-clay")}>
            {isGain ? "+" : ""}{holding.gainLossPct.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
