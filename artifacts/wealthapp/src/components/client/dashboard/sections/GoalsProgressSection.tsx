import { Link } from "wouter";
import type { DashboardGoal } from "@/hooks/useDashboardData";

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }

function statusBadge(goal: DashboardGoal) {
  if (!goal.targetDate || !goal.targetAmount) return null;
  const created = new Date(goal.createdAt);
  const target = new Date(goal.targetDate + "-01");
  const now = new Date();
  const totalMonths = (target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const elapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const expectedPct = totalMonths > 0 ? (elapsed / totalMonths) * 100 : 0;
  const currentPct = n(goal.targetAmount) > 0 ? (n(goal.currentAmount) / n(goal.targetAmount)) * 100 : 0;
  if (currentPct >= expectedPct * 0.9) return { label: "On track", bg: "#E6F5EE", text: "#0F6E56", msg: "Tracking ahead of your plan." };
  if (currentPct >= expectedPct * 0.6) return { label: "Behind", bg: "#FEF3D6", text: "#8A5B12", msg: "Behind by a few months." };
  return { label: "Off track", bg: "#FCE8E5", text: "#A63D2F", msg: "Needs attention." };
}

function PrimaryGoalCard({ goal }: { goal: DashboardGoal }) {
  const current = n(goal.currentAmount);
  const target = n(goal.targetAmount);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const badge = statusBadge(goal) || { label: "Active", bg: "#E6F5EE", text: "#0F6E56", msg: "On track" };
  const targetYear = goal.targetDate ? new Date(goal.targetDate).getFullYear() : "future";

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Link href="/client/goals">
      <div className="bg-white border border-[#E6E1D8] rounded-[24px] p-5 sm:p-6 shadow-[0_4px_14px_rgba(4,44,83,.06)] cursor-pointer hover:border-[#1D9E75] transition-colors">
        <div className="flex items-center justify-between mb-1">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B6459]">Your biggest goal</div>
          <div className="text-[11px] font-semibold px-2.5 py-1.25 rounded-full" style={{ backgroundColor: badge.bg, color: badge.text }}>
            {badge.label}
          </div>
        </div>
        <div className="font-display text-[19px] font-bold text-[#042C53] mb-4.5">{goal.title}</div>

        <div className="flex items-center gap-5.5">
          <div className="relative w-[132px] h-[132px] shrink-0">
            <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
              <circle cx="66" cy="66" r="54" fill="none" stroke="#F2EFE9" strokeWidth="14" />
              <circle cx="66" cy="66" r="54" fill="none" stroke="#1D9E75" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={offset} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-[30px] font-bold text-[#042C53] tracking-[-0.03em] leading-none">
                {pct.toFixed(0)}%
              </div>
              <div className="text-[11px] text-[#6B6459] mt-0.5">funded</div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl font-bold text-[#042C53] tracking-[-0.02em]">
              ${current.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-[#6B6459] mt-1">
              of ${target >= 1e6 ? (target/1e6).toFixed(1) + "m" : target.toLocaleString()} by {targetYear}
            </div>
            <div className="h-px bg-[#E6E1D8] my-3.5" />
            <div className="text-[13px] leading-[1.45] text-[#2D2A24] text-pretty">
              {badge.msg}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SmallGoalCard({ goal, color = "#1D9E75" }: { goal: DashboardGoal, color?: string }) {
  const current = n(goal.currentAmount);
  const target = n(goal.targetAmount);
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const badge = statusBadge(goal) || { label: "Active", bg: "#E6F5EE", text: "#0F6E56", msg: "On track" };
  
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Link href="/client/goals">
      <div className="flex-1 bg-white border border-[#E6E1D8] rounded-[20px] p-4 cursor-pointer hover:border-[#1D9E75] transition-colors">
        <div className="flex items-center gap-2.5 mb-2.5">
          <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90 shrink-0">
            <circle cx="17" cy="17" r="14" fill="none" stroke="#F2EFE9" strokeWidth="5" />
            <circle cx="17" cy="17" r="14" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset} />
          </svg>
          <div className="text-xs font-semibold text-[#042C53] leading-tight">
            {goal.title}<br />
            <span className="font-medium text-[#6B6459]">{pct.toFixed(0)}% funded</span>
          </div>
        </div>
        <div className="text-[11px] text-[#6B6459]">{badge.label === "On track" ? `On track for ${goal.targetDate ? new Date(goal.targetDate).getFullYear() : "future"}` : badge.msg}</div>
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
      <div className="bg-white border border-[#E6E1D8] rounded-xl p-6 text-center">
        <p className="text-sm text-[#6B6459] mb-2">No goals set yet.</p>
        <Link href="/client/goals">
          <span className="text-sm font-semibold text-[#1D9E75] hover:text-[#0F6E56]">Set your first goal →</span>
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
            <SmallGoalCard key={g.id} goal={g} color={i === 0 ? "#F5B947" : "#1D9E75"} />
          ))}
        </div>
      )}
    </div>
  );
}
