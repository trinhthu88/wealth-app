import { cn } from "@/lib/utils";
import MilestoneCard from "./MilestoneCard";
import type { PlanMilestone } from "@/hooks/usePlan";
import { Check } from "lucide-react";

interface Props {
  milestones: PlanMilestone[];
  nextMilestoneId: string | null;
}

function DotIndicator({ status, isNext }: { status: string; isNext: boolean }) {
  const group = status === "completed" ? "completed" : (status === "in_progress" || status === "active") ? "in_progress" : "upcoming";

  if (group === "completed") {
    return (
      <div className="h-5 w-5 rounded-full bg-field flex items-center justify-center shrink-0">
        <Check className="h-3 w-3 text-forest" aria-hidden="true" />
      </div>
    );
  }
  if (group === "in_progress") {
    return (
      <div className="relative shrink-0">
        <div className={cn(
          "h-5 w-5 rounded-full bg-paper border-2 border-forest",
          isNext && "ring-4 ring-forest/15"
        )} />
        <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-forest" />
      </div>
    );
  }
  return (
    <div className={cn(
      "h-5 w-5 rounded-full bg-paper border-2 border-hairline-2 shrink-0",
      isNext && "border-forest ring-4 ring-forest/15"
    )} />
  );
}

export default function PlanTimeline({ milestones, nextMilestoneId }: Props) {
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
              {!isLast && <div className="w-0.5 flex-1 bg-hairline mt-1 min-h-[20px]" />}
            </div>

            {/* Card */}
            <div className="flex-1 min-w-0 pb-4">
              {isNext && (
                <p className="tala-eyebrow text-forest mb-1.5">
                  Next up
                </p>
              )}
              <MilestoneCard step={step} isNext={isNext} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
