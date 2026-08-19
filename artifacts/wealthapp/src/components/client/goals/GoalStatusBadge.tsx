import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/hooks/useGoalProgress";

interface Props {
  status: GoalStatus;
}

const CONFIG: Record<GoalStatus, { label: string; className: string } | null> = {
  on_track:  { label: "On track ●",   className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  at_risk:   { label: "At risk",   className: "bg-amber-50  text-amber-700  border border-amber-200"  },
  off_track: { label: "Off track",  className: "bg-red-50    text-red-600    border border-red-200"    },
  completed: { label: "Completed",  className: "bg-teal-50   text-teal-700   border border-teal-200"   },
  no_target: null, // no badge shown
};

export default function GoalStatusBadge({ status }: Props) {
  const cfg = CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0", cfg.className)}>
      {cfg.label}
    </span>
  );
}
