import { Link } from "wouter";
import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  totalValue: number;
  gainLoss: number;
  gainLossPct: number;
  cagr: number | null;
  isTrackA: boolean;
  displayCurrency: string;
}

export default function PortfolioSnapshotSection({ totalValue, gainLossPct, isTrackA }: Props) {
  if (totalValue === 0) return null;

  return (
    <Link href="/client/wealth/investments">
      <div className="bg-surface rounded-[24px] p-5 cursor-pointer hover:ring-1 hover:ring-green transition-shadow mb-3.5">
        <div className="tala-eyebrow text-ink-40 mb-2">
          Everything tracked in tala
        </div>
        <div className="font-display tabular-nums text-[32px] text-forest tracking-[-0.03em] leading-none">
          <CurrencyField amountUsd={totalValue} compact />
        </div>
        <div className="text-xs text-ink-40 mt-2">
          {isTrackA ? "Advised and self-managed" : "Self-managed accounts"} · {gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(1)}% return
        </div>
      </div>
    </Link>
  );
}
