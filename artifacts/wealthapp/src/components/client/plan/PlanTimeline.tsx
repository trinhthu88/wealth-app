import { cn } from "@/lib/utils";
import MilestoneCard from "./MilestoneCard";
import type { PlanMilestone } from "@/hooks/usePlan";

interface Props {
  milestones: PlanMilestone[];
  nextMilestoneId: string | null;
  statusGroup: (s: string) => string;
}

function DotIndicator({ status, isNext }: { status: string; isNext: boolean }) {
  const group = status === "completed" ? "completed" : (status === "in_progress" || status === "active") ? "in_progress" : "upcoming";

  if (group === "completed") {
    return (
      <div className="h-5 w-5 rounded-full bg-[#1D9E75] flex items-center justify-center shrink-0">
        <span className="text-white text-[10px] font-bold">✓</span>
      </div>
    );
  }
  if (group === "in_progress") {
    return (
      <div className="relative shrink-0">
        <div className={cn(
          "h-5 w-5 rounded-full bg-[#1D9E75]/20 border-2 border-[#1D9E75]",
          isNext && "ring-4 ring-[#1D9E75]/20"
        )} />
        <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-[#1D9E75]" />
      </div>
    );
  }
  return (
    <div className={cn(
      "h-5 w-5 rounded-full bg-white border-2 border-slate-300 shrink-0",
      isNext && "border-[#1D9E75] ring-4 ring-[#1D9E75]/20"
    )} />
  );
}

export default function PlanTimeline({ milestones, nextMilestoneId, statusGroup }: Props) {
  return (
    <div className="space-y-0">
      {milestones.map((step, idx) => {
        const isNext = step.id === nextMilestoneId;
        const isLast = idx === milestones.length - 1;

        return (
          <div key={step.id} className="flex gap-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center shrink-0 pt-4">
              <DotIndicator status={step.status} isNext={isNext} />
              {!isLast && <div className="w-0.5 flex-1 bg-[#E2E8F0] mt-1 min-h-[20px]" />}
            </div>

            {/* Card */}
            <div className="flex-1 min-w-0 pb-4">
              {isNext && (
                <p className="text-[11px] font-semibold text-[#1D9E75] uppercase tracking-wide mb-1.5">
                  Next up
                </p>
              )}
              <MilestoneCard step={step} isNext={isNext} statusGroup={statusGroup} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
