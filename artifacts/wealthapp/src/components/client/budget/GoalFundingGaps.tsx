import { Link } from "wouter";
import { useGoals } from "@/hooks/useGoals";
import { AlertTriangle, ArrowRight, CheckCircle2, Target } from "lucide-react";

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
        <p className="tala-eyebrow text-ink-40">Goal funding</p>
        <p className="text-xs text-ink-40">
          Set targets on your goals to see funding gaps.{" "}
          <Link href="/client/goals" className="inline-flex items-center gap-1 font-semibold text-green hover:text-forest">
            Go to goals <ArrowRight className="h-3 w-3" aria-hidden="true" />
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
      <p className="tala-eyebrow text-ink-40">Goal funding</p>

      {allFunded && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-green">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          All goals funded at the current contribution rate
        </p>
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

        return (
          <div key={goal.id} className="space-y-2 rounded-[18px] border border-hairline bg-paper p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-tint text-green">
                <Target className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="truncate text-xs font-semibold text-forest">{goal.title}</p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-40">
              <span>Needs: {fmtUsd(needed)}/mo</span>
              <span className={isFunded ? "text-green font-semibold" : "text-amber-ink font-semibold"}>
                Invested: {fmtUsd(invested)}/mo
              </span>
            </div>

            <div className="h-2 bg-track rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: `${fundedPct}%`,
                  background: isFunded ? "var(--green)" : fundedPct >= 50 ? "var(--sun)" : "var(--clay)",
                }}
              />
            </div>

            {isFunded ? (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-green">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Funded
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-ink">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Gap: {fmtUsd(gap)}/mo
                </p>
                <Link
                  href={`/client/scenarios?goalId=${goal.id}&type=increase_monthly`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-green hover:text-forest"
                >
                  Close this gap <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
