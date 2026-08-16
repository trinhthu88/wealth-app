import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { DashboardGoal } from "@/hooks/useDashboardData";

const GOAL_EMOJIS: Record<string, string> = {
  retire: "🌴", property: "🏠", education: "📚", fire: "🚀",
  business: "💼", emigrate: "🌍", wealth: "💰", emergency: "🛡",
};

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }

function statusBadge(goal: DashboardGoal): { label: string; color: string } | null {
  if (!goal.targetDate || !goal.targetAmount) return null;
  const created = new Date(goal.createdAt);
  const target = new Date(goal.targetDate + "-01");
  const now = new Date();
  const totalMonths = (target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const elapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const expectedPct = totalMonths > 0 ? (elapsed / totalMonths) * 100 : 0;
  const currentPct = n(goal.targetAmount) > 0 ? (n(goal.currentAmount) / n(goal.targetAmount)) * 100 : 0;
  if (currentPct >= expectedPct * 0.9) return { label: "On track", color: "text-emerald-600" };
  if (currentPct >= expectedPct * 0.6) return { label: "At risk", color: "text-amber-600" };
  return { label: "Off track", color: "text-red-500" };
}

function GoalCard({ goal }: { goal: DashboardGoal }) {
  const hasTarget = n(goal.targetAmount) > 0;
  const current = n(goal.currentAmount);
  const target = n(goal.targetAmount);
  const pct = hasTarget && target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const badge = statusBadge(goal);
  const emoji = GOAL_EMOJIS[goal.goalType] ?? "💰";

  return (
    <Link href="/client/goals">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 cursor-pointer hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{emoji}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#042C53] truncate">{goal.title}</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                {hasTarget
                  ? `Target: $${target.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                  : "No target set"}
                {goal.targetDate && ` · ${new Date(goal.targetDate + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
              </p>
            </div>
          </div>
          {badge && (
            <div className="flex items-center gap-1 shrink-0">
              <div className={cn("h-2 w-2 rounded-full",
                badge.label === "On track" ? "bg-emerald-500" :
                badge.label === "At risk" ? "bg-amber-500" : "bg-red-500"
              )} />
              <span className={cn("text-[11px] font-medium", badge.color)}>{badge.label}</span>
            </div>
          )}
        </div>

        {hasTarget && (
          <>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-[#1D9E75] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-[#64748B]">
              ${current.toLocaleString("en-US", { maximumFractionDigits: 0 })} / ${target.toLocaleString("en-US", { maximumFractionDigits: 0 })} ({pct.toFixed(0)}%)
            </p>
          </>
        )}
      </div>
    </Link>
  );
}

interface Props {
  goals: DashboardGoal[];
  totalGoals?: number;
}

export default function GoalsProgressSection({ goals, totalGoals }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#042C53]">Your goals</p>
        <div className="flex items-center gap-3">
          {totalGoals !== undefined && totalGoals > 0 && (
            <span className="text-xs text-[#64748B]">{totalGoals} total</span>
          )}
          <Link href="/client/goals">
            <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">View all →</span>
          </Link>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 text-center">
          <p className="text-sm text-[#64748B] mb-2">No goals set yet.</p>
          <Link href="/client/goals">
            <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">Set your first goal →</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
          {goals.slice(0, 3).map(goal => <GoalCard key={goal.id} goal={goal} />)}
        </div>
      )}
    </div>
  );
}
