import { useEffect, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { DotProps } from "recharts";
import { useWealthScore, type WealthScoreDimensions } from "@/hooks/useWealthScore";
import WealthScoreRing from "./WealthScoreRing";

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
    key: "debtToAsset", label: "Debt-to-Asset Ratio",
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
  const { isLoading, isGated, hasData, row, sparklineData, trendDelta } = useWealthScore();
  const cardRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return <div className="h-[340px] bg-surface rounded-[26px] animate-pulse" />;
  }

  if (isGated) {
    return (
      <div className="bg-surface rounded-[26px] p-[22px_24px] shadow-[0_2px_14px_rgba(20,52,42,.06)] text-center">
        <div className="font-display text-[18px] font-semibold text-forest mb-1.5">Wealth Score</div>
        <p className="text-[14px] text-ink-40 leading-relaxed text-pretty">
          Your Wealth Score is building — check back after 3 months of activity.
        </p>
      </div>
    );
  }

  if (!hasData || !row?.details) {
    return (
      <div className="bg-surface rounded-[26px] p-[22px_24px] shadow-[0_2px_14px_rgba(20,52,42,.06)] text-center">
        <div className="font-display text-[18px] font-semibold text-forest mb-1.5">Wealth Score</div>
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
    <div ref={cardRef} className="bg-surface rounded-[26px] p-[22px_24px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
      <div className="flex items-center gap-5">
        <WealthScoreRing score={row.overallScore} />
        <div>
          <div className="text-[16px] font-semibold" style={{ color: tier.color }}>{tier.label}</div>
          {trendDelta != null && trendDelta !== 0 && (
            <div className={`text-[13px] font-semibold mt-0.5 ${trendDelta > 0 ? "text-green" : "text-clay"}`}>
              {trendDelta > 0 ? "↑" : "↓"} {trendDelta > 0 ? "+" : ""}{trendDelta} vs last score
            </div>
          )}
        </div>
      </div>

      {sparklineData.length > 1 && (
        <div className="h-[36px] mt-3" role="img" aria-label="Wealth score trend, last 6 months">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Line
                type="monotone"
                dataKey="overallScore"
                stroke="var(--green)"
                strokeWidth={1.75}
                dot={(dotProps: DotProps & { index?: number }) =>
                  dotProps.index === sparklineData.length - 1 ? (
                    <circle key="last" cx={dotProps.cx} cy={dotProps.cy} r={3} fill="var(--green)" />
                  ) : (
                    <circle key={dotProps.index} cx={dotProps.cx} cy={dotProps.cy} r={0} fill="none" />
                  )
                }
                activeDot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-hairline space-y-3">
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

      <div className="mt-4 bg-sun-tint rounded-[16px] p-[14px_16px] text-[13.5px] text-amber-ink leading-relaxed text-pretty">
        {lowest.tip}
      </div>
    </div>
  );
}
