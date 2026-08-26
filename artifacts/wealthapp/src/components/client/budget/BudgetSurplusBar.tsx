import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  netSurplus: number;
  savingsRatePct: number;
}

export default function BudgetSurplusBar({ netSurplus, savingsRatePct }: Props) {
  return (
    <div className="bg-green-tint rounded-[22px] p-[18px_20px] flex items-center gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-ink-40 mb-1">Net Surplus</p>
        <p className="font-display text-[26px] font-semibold text-green tracking-[-0.02em] tabular-nums truncate">
          <CurrencyField amountUsd={netSurplus} />
        </p>
      </div>
      <div className="w-px self-stretch bg-green/20" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-ink-40 mb-1">Savings Rate %</p>
        <p className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em] tabular-nums">
          {Math.round(savingsRatePct)}%
        </p>
      </div>
    </div>
  );
}
