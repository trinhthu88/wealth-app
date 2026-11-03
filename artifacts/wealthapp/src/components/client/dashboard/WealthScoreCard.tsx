import { useEffect, useState } from "react";
import { useWealthScore, type WealthScoreDimensions } from "@/hooks/useWealthScore";
import WealthScoreRing from "./WealthScoreRing";
import BottomSheet from "@/components/client/BottomSheet";
import Sol from "@/components/Sol";
import { ArrowUpRight } from "lucide-react";
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

// Tier shown as a status pill: Cobalt for on-track tiers, Blue Breeze for
// growing, Sunset Pop only when the score needs attention.
function tierFor(score: number): { label: string; pill: string } {
  if (score >= 85) return { label: "Excellent", pill: "bg-forest text-paper" };
  if (score >= 70) return { label: "Strong", pill: "bg-forest text-paper" };
  if (score >= 50) return { label: "Growing", pill: "bg-breeze text-forest" };
  return { label: "Building", pill: "bg-sun text-forest" };
}

function barColor(key: keyof WealthScoreDimensions, value: number): string {
  if (key === "goalProgress" || key === "debtToAsset") {
    return value < 70 ? "var(--sun)" : "var(--forest)";
  }
  return "var(--forest)";
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
    <div className="h-2 w-full rounded-full bg-forest/15 overflow-hidden">
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
    return <div className="h-[112px] bg-surface rounded-[24px] animate-pulse" />;
  }

  if (isGated) {
    return (
      <div className="bg-surface rounded-[24px] p-5">
        <div className="text-[16px] font-semibold text-forest mb-1">Wealth Score</div>
        <p className="text-[14px] text-ink-40 leading-relaxed text-pretty">
          Your Wealth Score is building — check back after 3 months of activity.
        </p>
      </div>
    );
  }

  if (!hasData || !row?.details) {
    return (
      <div className="bg-surface rounded-[24px] p-5">
        <div className="text-[16px] font-semibold text-forest mb-1">Wealth Score</div>
        <p className="text-[14px] text-ink-40 leading-relaxed text-pretty">
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
        className="w-full text-left bg-surface rounded-[24px] p-5 flex items-center gap-4 transition-colors hover:ring-1 hover:ring-green"
        aria-haspopup="dialog"
      >
        <WealthScoreRing score={row.overallScore} size={72} />
        <div className="min-w-0 flex-1">
          <div className="tala-eyebrow text-ink-40">Wealth Score</div>
          <span className={cn("inline-block mt-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", tier.pill)}>{tier.label}</span>
          {trendDelta != null && trendDelta !== 0 && (
            <div className={cn("text-[13px] font-medium mt-1.5 tabular-nums", trendDelta > 0 ? "text-forest" : "text-clay-ink")}>
              {trendDelta > 0 ? "↑" : "↓"} {trendDelta > 0 ? "+" : ""}{trendDelta} vs last month
            </div>
          )}
        </div>
        <div className="w-9 h-9 rounded-full bg-forest text-paper flex-none flex items-center justify-center">
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </div>
      </button>

      <BottomSheet isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Wealth Score">
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <WealthScoreRing score={row.overallScore} size={100} />
            <div>
              <span className={cn("inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold", tier.pill)}>{tier.label}</span>
              {trendDelta != null && trendDelta !== 0 && (
                <div className={cn("text-[13px] font-medium mt-1.5 tabular-nums", trendDelta > 0 ? "text-forest" : "text-clay-ink")}>
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
                  <span className="text-[13px] text-ink-40 w-[150px] shrink-0">{d.label}</span>
                  <AnimatedBar value={value} color={barColor(d.key, value)} />
                  <span className="text-[13px] font-semibold text-forest tabular-nums w-[36px] text-right shrink-0">{Math.round(value)}%</span>
                </div>
              );
            })}
          </div>

          <div className="bg-breeze rounded-[24px] p-4 flex items-start gap-3">
            <Sol size="xs" animate="breathe" />
            <p className="text-[14px] text-forest leading-relaxed text-pretty">{lowest.tip}</p>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
