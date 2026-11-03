import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  progressPct: number | null;
  currentAmount: number;
  targetAmount: number | null;
  hasLinks: boolean;
  onSetTarget: () => void;
}

export default function GoalProgressBar({ progressPct, currentAmount, targetAmount, hasLinks, onSetTarget }: Props) {
  if (progressPct === null || !targetAmount) {
    return (
      <button
        onClick={onSetTarget}
        className="text-[13px] text-green font-semibold hover:underline text-left"
      >
        Set a target amount to track progress →
      </button>
    );
  }

  const pct = Math.min(100, Math.max(0, progressPct));

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="h-2 bg-forest/15 rounded-full overflow-hidden">
        <div
          className="h-full bg-forest rounded-full transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-ink-40 tabular-nums">
          <CurrencyField amountUsd={currentAmount} compact /> / <CurrencyField amountUsd={targetAmount} compact />
        </span>
        <span className="font-semibold text-forest tabular-nums">{Math.round(pct)}%</span>
      </div>
      {hasLinks && (
        <p className="text-[12px] text-ink-40">Auto-updated from linked investments.</p>
      )}
    </div>
  );
}
