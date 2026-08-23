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
    <Link href="/client/portfolio">
      <div className="bg-white border border-[#E6E1D8] rounded-[24px] p-5 shadow-[0_4px_14px_rgba(4,44,83,.06)] cursor-pointer hover:border-[#1D9E75] transition-colors mb-3.5">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B6459] mb-2">
          Everything tracked in tala
        </div>
        <div className="font-display text-[32px] font-bold text-[#042C53] tracking-[-0.03em] leading-none">
          <CurrencyField amountUsd={totalValue} compact />
        </div>
        <div className="text-xs text-[#6B6459] mt-2">
          {isTrackA ? "Advised and self-managed" : "Self-managed accounts"} · {gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(1)}% return
        </div>
      </div>
    </Link>
  );
}
