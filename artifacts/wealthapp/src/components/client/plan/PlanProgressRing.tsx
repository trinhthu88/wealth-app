import { cn } from "@/lib/utils";

interface Props {
  completedCount: number;
  inProgressCount: number;
  upcomingCount: number;
  totalCount: number;
  completionPct: number;
}

export default function PlanProgressRing({
  completedCount, inProgressCount, upcomingCount, totalCount, completionPct,
}: Props) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (completionPct / 100) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      {/* Ring */}
      <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#E2E8F0" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r}
            fill="none" stroke="#1D9E75" strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-[#042C53]">{completedCount}/{totalCount}</span>
          <span className="text-[10px] text-slate-400">milestones</span>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        {completedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            ✓ {completedCount} Complete
          </span>
        )}
        {inProgressCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#1D9E75]/10 text-[#1D9E75]">
            → {inProgressCount} In progress
          </span>
        )}
        {upcomingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
            ○ {upcomingCount} Upcoming
          </span>
        )}
        {totalCount === 0 && (
          <span className="text-sm text-slate-400">No milestones yet</span>
        )}
      </div>
    </div>
  );
}
