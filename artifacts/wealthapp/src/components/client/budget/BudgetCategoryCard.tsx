import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  label: string;
  total: number;
  pctOfIncome: number; // 0-100, clamped by caller
  borderColor: string; // CSS color value for the left border + bar fill
  onClick: () => void;
}

export default function BudgetCategoryCard({ label, total, pctOfIncome, borderColor, onClick }: Props) {
  const [fillPct, setFillPct] = useState(0);

  // Animate the bar fill once on mount (600ms ease-out) — not on every re-render.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFillPct(pctOfIncome));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-surface rounded-[20px] p-[16px_18px] shadow-[0_2px_14px_rgba(20,52,42,.06)] flex items-center gap-3.5"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[14px] font-semibold text-forest">{label}</span>
          <span className="text-[15px] font-semibold text-forest tabular-nums">
            <CurrencyField amountUsd={total} />
          </span>
        </div>
        <div className="h-[5px] rounded-full bg-track overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
            style={{ width: `${Math.min(100, Math.max(0, fillPct))}%`, backgroundColor: borderColor }}
          />
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-30" aria-hidden="true" />
    </button>
  );
}
