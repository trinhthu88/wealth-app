import { useEffect, useState } from "react";
import { useWealthScore, type WealthScoreDimensions } from "@/hooks/useWealthScore";
import WealthScoreRing from "./WealthScoreRing";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";

const DIMENSION_META: { key: keyof WealthScoreDimensions; label: string; tip: string }[] = [
  {
    key: "savingsConsistency", label: "Savings Consistency",
    tip: "Set up a monthly reminder to log your budget — consistent tracking is the #1 score driver.",
  },
  {
    key: "investmentGrowth", label: "Investment Growth",
    tip: "Your portfolio hasn't grown above contributions yet. Check your allocation in Portfolio.",
  },
  {
    key: "goalProgress", label: "Goal Progress",
    tip: "One or more goals are behind schedule. Review your goals and adjust your target date or amount.",
  },
  {
    key: "debtToAsset", label: "Debt Ratio",
    tip: "Your liabilities are high relative to assets. An extra repayment this month improves this score.",
  },
  {
    key: "budgetSurplus", label: "Budget Surplus",
    tip: "Your surplus is low. Review your Expenses section to find one category to reduce.",
  },
];

function tierFor(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "#0F7A5C" }; // a deeper teal — this palette has no separate success-green
  if (score >= 70) return { label: "Strong", color: "var(--green)" };
  if (score >= 50) return { label: "Growing", color: "#3B82F6" }; // one-off blue — no blue token exists in this app's palette
  return { label: "Building", color: "var(--sun-deep)" };
}

function barColor(key: keyof WealthScoreDimensions, value: number): string {
  if (key === "goalProgress" || key === "debtToAsset") {
    return value < 70 ? "var(--sun-deep)" : "var(--green)";
  }
  return "var(--green)";
}

function AnimatedBar({ value, color }: { value: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(Math.min(100, Math.max(0, value))));
    return () => cancelAnimationFrame(raf);
    // Animate once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="h-[6px] w-full rounded-full bg-track overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, backgroundColor: color, transition: "width 600ms ease-out" }}
      />
    </div>
  );
}

export default function WealthScoreCard() {
  const { isLoading, isGated, hasData, row, trendDelta } = useWealthScore();
  const [detailOpen, setDetailOpen] = useState(false);

  if (isLoading) {
    return <div className="h-[104px] bg-surface rounded-[26px] animate-pulse" />;
  }

  if (isGated) {
    return (
      <div className="bg-surface rounded-[26px] border-l-[3px] border-l-green p-[22px_24px] shadow-[0_2px_14px_rgba(20,52,42,.06)] text-center">
        <div className="font-display text-[16px] font-semibold text-forest mb-1.5">Wealth Score</div>
        <p className="text-[13.5px] text-ink-40 leading-relaxed text-pretty">
          Your Wealth Score is building — check back after 3 months of activity.
        </p>
      </div>
    );
  }

  if (!hasData || !row?.details) {
    return (
      <div className="bg-surface rounded-[26px] border-l-[3px] border-l-green p-[22px_24px] shadow-[0_2px_14px_rgba(20,52,42,.06)] text-center">
        <div className="font-display text-[16px] font-semibold text-forest mb-1.5">Wealth Score</div>
        <p className="text-[13.5px] text-ink-40 leading-relaxed text-pretty">
          Add your current budget, goals, and portfolio details so tala can calculate your score.
        </p>
      </div>
    );
  }

  const { dimensions } = row.details;
  const tier = tierFor(row.overallScore);
  const lowest = DIMENSION_META.reduce((low, d) => (dimensions[d.key] < dimensions[low.key] ? d : low), DIMENSION_META[0]);

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="w-full text-left bg-surface rounded-[26px] border-l-[3px] border-l-green p-[18px_22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] flex items-center gap-4 transition-colors hover:bg-hairline/20"
        aria-haspopup="dialog"
      >
        <WealthScoreRing score={row.overallScore} size={72} />
        <div className="min-w-0">
          <div className="text-[16px] font-semibold" style={{ color: tier.color }}>{tier.label}</div>
          {trendDelta != null && trendDelta !== 0 ? (
            <div className={cn("text-[13px] font-semibold mt-0.5", trendDelta > 0 ? "text-green" : "text-clay")}>
              {trendDelta > 0 ? "↑" : "↓"} {trendDelta > 0 ? "+" : ""}{trendDelta} vs last month
            </div>
          ) : (
            <div className="text-[13px] text-ink-40 mt-0.5">Wealth Score</div>
          )}
        </div>
      </button>

      <BottomSheet isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Wealth Score">
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <WealthScoreRing score={row.overallScore} size={100} />
            <div>
              <div className="text-[18px] font-semibold" style={{ color: tier.color }}>{tier.label}</div>
              {trendDelta != null && trendDelta !== 0 && (
                <div className={cn("text-[13px] font-semibold mt-0.5", trendDelta > 0 ? "text-green" : "text-clay")}>
                  {trendDelta > 0 ? "↑" : "↓"} {trendDelta > 0 ? "+" : ""}{trendDelta} vs last month
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {DIMENSION_META.map(d => {
              const value = dimensions[d.key];
              return (
                <div key={d.key} className="flex items-center gap-3">
                  <span className="text-[13px] text-ink-60 w-[150px] shrink-0">{d.label}</span>
                  <AnimatedBar value={value} color={barColor(d.key, value)} />
                  <span className="text-[13px] font-semibold text-forest tabular-nums w-[36px] text-right shrink-0">{Math.round(value)}%</span>
                </div>
              );
            })}
          </div>

          <div className="bg-sun-tint rounded-[16px] p-[14px_16px] text-[13.5px] text-amber-ink leading-relaxed text-pretty">
            {lowest.tip}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
