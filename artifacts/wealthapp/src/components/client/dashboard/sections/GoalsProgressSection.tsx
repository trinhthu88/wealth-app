import { Link } from "wouter";
import { computeGoalProgress, type GoalStatus } from "@workspace/goal-math";
import type { DashboardGoal } from "@/hooks/useDashboardData";

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }

const BADGE_BY_STATUS: Record<GoalStatus, { label: string; bg: string; text: string; msg: string }> = {
  on_track:  { label: "On track",  bg: "var(--forest)", text: "var(--paper)", msg: "Tracking ahead of your plan." },
  at_risk:   { label: "Behind",    bg: "var(--sun)", text: "var(--forest)", msg: "Behind by a few months." },
  off_track: { label: "Off track", bg: "var(--sun)", text: "var(--forest)", msg: "Needs attention." },
  completed: { label: "Achieved",  bg: "var(--forest)", text: "var(--paper)", msg: "Goal reached." },
  no_target: { label: "Active",    bg: "var(--breeze)", text: "var(--forest)", msg: "On track" },
};

// Reuses the canonical investment-client pacing model (@workspace/goal-math) so this
// dashboard card can't drift from the goals page's own status calculation.
function statusBadge(goal: DashboardGoal) {
  const { status } = computeGoalProgress({
    currentAmount: n(goal.currentAmount),
    targetAmount: goal.targetAmount ? n(goal.targetAmount) : null,
    targetDate: goal.targetDate,
    createdAt: goal.createdAt,
  });
  return BADGE_BY_STATUS[status];
}

function PrimaryGoalCard({ goal }: { goal: DashboardGoal }) {
  const current = n(goal.currentAmount);
  const target = n(goal.targetAmount);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const badge = statusBadge(goal);
  const targetYear = goal.targetDate ? new Date(goal.targetDate).getFullYear() : "future";

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Link href="/client/goals/goals">
      <div className="bg-surface rounded-[24px] p-5 sm:p-6 cursor-pointer hover:ring-1 hover:ring-green transition-shadow">
        <div className="flex items-center justify-between mb-1">
          <div className="tala-eyebrow text-ink-40">Your biggest goal</div>
          <div className="text-[11px] font-semibold px-2.5 py-1.25 rounded-full" style={{ backgroundColor: badge.bg, color: badge.text }}>
            {badge.label}
          </div>
        </div>
        <div className="text-[16px] font-semibold text-forest mb-4.5">{goal.title}</div>

        <div className="flex items-center gap-5.5">
          <div className="relative w-[132px] h-[132px] shrink-0">
            <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
              <circle cx="66" cy="66" r="54" fill="none" stroke="var(--forest)" strokeOpacity={0.15} strokeWidth="14" />
              <circle cx="66" cy="66" r="54" fill="none" stroke="var(--forest)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={offset} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display tabular-nums text-[30px] text-forest tracking-[-0.03em] leading-none">
                {pct.toFixed(0)}%
              </div>
              <div className="text-[11px] text-ink-40 mt-0.5">funded</div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[18px] font-semibold tabular-nums text-forest tracking-[-0.02em]">
              ${current.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-ink-40 mt-1">
              of ${target >= 1e6 ? (target/1e6).toFixed(1) + "m" : target.toLocaleString()} by {targetYear}
            </div>
            <div className="h-px bg-field my-3.5" />
            <div className="text-[13px] leading-[1.45] text-forest text-pretty">
              {badge.msg}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SmallGoalCard({ goal, color = "var(--forest)" }: { goal: DashboardGoal, color?: string }) {
  const current = n(goal.currentAmount);
  const target = n(goal.targetAmount);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const badge = statusBadge(goal);
  
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Link href="/client/goals/goals">
      <div className="flex-1 bg-surface rounded-[24px] p-4 cursor-pointer hover:ring-1 hover:ring-green transition-shadow">
        <div className="flex items-center gap-2.5 mb-2.5">
          <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90 shrink-0">
            <circle cx="17" cy="17" r="14" fill="none" stroke="var(--forest)" strokeOpacity={0.15} strokeWidth="5" />
            <circle cx="17" cy="17" r="14" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="text-xs font-semibold text-forest leading-tight">
            {goal.title}<br />
            <span className="font-medium text-ink-40">{pct.toFixed(0)}% funded</span>
          </div>
        </div>
        <div className="text-[11px] text-ink-40">{badge.label === "On track" ? `On track for ${goal.targetDate ? new Date(goal.targetDate).getFullYear() : "future"}` : badge.msg}</div>
      </div>
    </Link>
  );
}

interface Props {
  goals: DashboardGoal[];
  totalGoals?: number;
}

export default function GoalsProgressSection({ goals, totalGoals }: Props) {
  if (goals.length === 0) {
    return (
      <div className="bg-surface rounded-[24px] p-6 text-center">
        <p className="text-sm text-ink-40 mb-2">No goals set yet.</p>
        <Link href="/client/goals/goals">
          <span className="text-sm font-semibold text-forest underline underline-offset-4">Set your first goal →</span>
        </Link>
      </div>
    );
  }

  const primary = goals[0];
  const others = goals.slice(1, 3);

  return (
    <div className="space-y-3.5">
      <PrimaryGoalCard goal={primary} />
      {others.length > 0 && (
        <div className="flex gap-3">
          {others.map((g, i) => (
            <SmallGoalCard key={g.id} goal={g} color={i === 0 ? "var(--sun)" : "var(--forest)"} />
          ))}
        </div>
      )}
    </div>
  );
}
