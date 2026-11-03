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
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--hairline)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r}
            fill="none" stroke="var(--forest)" strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display tabular-nums text-[28px] leading-none text-forest">{completedCount}/{totalCount}</span>
          <span className="tala-eyebrow text-ink-40 mt-1">milestones</span>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        {completedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-field text-forest">
            {completedCount} Complete
          </span>
        )}
        {inProgressCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-forest text-paper">
            {inProgressCount} In progress
          </span>
        )}
        {upcomingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-surface text-forest">
            {upcomingCount} Upcoming
          </span>
        )}
        {totalCount === 0 && (
          <span className="text-[14px] text-ink-40">No milestones yet</span>
        )}
      </div>
    </div>
  );
}
