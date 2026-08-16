import { Link } from "wouter";
import { useGoals } from "@/hooks/useGoals";
import { cn } from "@/lib/utils";

function fmtUsd(n: number) {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}

interface Props {
  totalMonthlyInvestments: number;
}

export default function GoalFundingGaps({ totalMonthlyInvestments }: Props) {
  const { activeGoals, loading } = useGoals();

  if (loading) return null;

  // Only goals with both target_amount and target_date
  const goalsWith = activeGoals
    .filter(g => g.targetAmountNum && g.targetDate)
    .slice(0, 3);

  if (goalsWith.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Goal funding</p>
        <p className="text-xs text-slate-400">
          Set targets on your goals to see funding gaps.{" "}
          <Link href="/client/goals" className="text-[#1D9E75] font-medium hover:underline">
            Go to goals →
          </Link>
        </p>
      </div>
    );
  }

  const allFunded = goalsWith.every(g => {
    const now = new Date();
    const target = new Date(g.targetDate!);
    const months = monthsBetween(now, target);
    if (months <= 0) return true;
    const needed = (g.targetAmountNum! - g.computedCurrentAmount) / months;
    return totalMonthlyInvestments >= needed;
  });

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Goal funding</p>

      {allFunded && (
        <p className="text-xs text-emerald-600 font-medium">All goals funded at current contribution rate ✓</p>
      )}

      {goalsWith.map(goal => {
        const now = new Date();
        const target = new Date(goal.targetDate!);
        const months = Math.max(1, monthsBetween(now, target));
        const needed = (goal.targetAmountNum! - goal.computedCurrentAmount) / months;
        const invested = totalMonthlyInvestments;
        const gap = needed - invested;
        const isFunded = invested >= needed;
        const fundedPct = needed > 0 ? Math.min(100, (invested / needed) * 100) : 100;

        const GOAL_EMOJIS: Record<string, string> = {
          retire: "🌴", property: "🏠", education: "📚", fire: "🚀",
          business: "💼", emigrate: "🌍", wealth: "💰", emergency: "🛡️", other: "🎯",
        };

        return (
          <div key={goal.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{GOAL_EMOJIS[goal.goalType] ?? "🎯"}</span>
              <p className="text-xs font-semibold text-[#042C53] truncate">{goal.title}</p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Needs: {fmtUsd(needed)}/mo</span>
              <span className={isFunded ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                Invested: {fmtUsd(invested)}/mo
              </span>
            </div>

            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: `${fundedPct}%`,
                  background: isFunded ? "#1D9E75" : fundedPct >= 50 ? "#F59E0B" : "#EF4444",
                }}
              />
            </div>

            {isFunded ? (
              <p className="text-[11px] text-emerald-600 font-medium">Funded ✓</p>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-amber-600 font-medium">Gap: {fmtUsd(gap)}/mo ⚠</p>
                <Link
                  href={`/client/scenarios?goalId=${goal.id}&type=increase_monthly`}
                  className="text-[11px] text-[#1D9E75] font-medium hover:underline"
                >
                  Close this gap →
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
