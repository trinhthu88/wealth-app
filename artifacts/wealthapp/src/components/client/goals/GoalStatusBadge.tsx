import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/hooks/useGoalProgress";

interface Props {
  status: GoalStatus;
}

const CONFIG: Record<GoalStatus, { label: string; className: string } | null> = {
  on_track:  { label: "On track ●", className: "bg-forest text-paper" },
  at_risk:   { label: "At risk",    className: "bg-sun text-forest"   },
  off_track: { label: "Off track",  className: "bg-sun text-forest"   },
  completed: { label: "Completed",  className: "bg-field text-forest" },
  no_target: null, // no badge shown
};

export default function GoalStatusBadge({ status }: Props) {
  const cfg = CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold leading-none shrink-0", cfg.className)}>
      {cfg.label}
    </span>
  );
}
