import CurrencyDisplay from "@/components/client/CurrencyDisplay";

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
        className="text-xs text-[#1D9E75] font-medium hover:underline text-left"
      >
        Set a target amount to track progress →
      </button>
    );
  }

  const pct = Math.min(100, Math.max(0, progressPct));

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1D9E75] rounded-full transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          <CurrencyDisplay amountUsd={currentAmount} compact /> / <CurrencyDisplay amountUsd={targetAmount} compact />
        </span>
        <span className="font-semibold text-[#042C53]">{Math.round(pct)}%</span>
      </div>
      {hasLinks && (
        <p className="text-[11px] text-slate-400">Auto-updated from linked investments.</p>
      )}
    </div>
  );
}
