import { X } from "lucide-react";
import type { CheckpointCode } from "@workspace/tier-policy";
import { useCheckpoint } from "@/hooks/useCheckpoint";
import { checkpointCopy } from "@/lib/checkpointCopy";
import { cn } from "@/lib/utils";
import Sol from "@/components/Sol";
import C8PlanPreview from "@/components/client/C8PlanPreview";

interface Props {
  codes: readonly CheckpointCode[];
  className?: string;
  /** Only show a checkpoint whose snapshot is about this goal. */
  goalId?: string;
}

/**
 * One checkpoint's offer: the server's open checkpoint, its copy, accept and dismiss.
 * Accepting raises a free user's hand and opens messages for a client; see useCheckpoint.
 */
export default function CheckpointCard({ codes, className, goalId }: Props) {
  const { checkpoint, accept, dismiss } = useCheckpoint(codes);
  if (!checkpoint) return null;
  if (goalId && checkpoint.snapshot.goalId !== goalId) return null;

  const { body, action } = checkpointCopy(checkpoint.code, checkpoint.snapshot);
  return (
    <section
      aria-label="A suggestion from Sol"
      data-testid={`checkpoint-${checkpoint.code}`}
      className={cn("relative flex items-start gap-3 rounded-[24px] bg-breeze p-4 pr-12", className)}
    >
      <div className="shrink-0"><Sol size="sm" animate="idle" showRays={false} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-pretty text-[14px] leading-[1.45] text-forest">{body}</p>
        {checkpoint.code === "C8_plan_preview" && (
          <C8PlanPreview monthlySurplus={Number(checkpoint.snapshot.monthlySurplus) || 0} />
        )}
        {action && (
          <button
            type="button"
            onClick={() => accept.mutate()}
            disabled={accept.isPending}
            className="mt-3 inline-flex h-10 items-center rounded-full bg-forest px-4 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {action}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss.mutate()}
        aria-label="Not now"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-forest/60 hover:text-forest"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}
