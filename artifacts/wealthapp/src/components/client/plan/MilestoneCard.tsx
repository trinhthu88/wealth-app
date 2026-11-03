import { useState } from "react";
import { Link } from "wouter";
import { MessageSquare, ChevronDown, ChevronUp, Target } from "lucide-react";
import MilestoneComments from "./MilestoneComments";
import AddCommentForm from "./AddCommentForm";
import { useMilestoneComments } from "@/hooks/useMilestoneComments";
import { cn } from "@/lib/utils";
import type { PlanMilestone } from "@/hooks/usePlan";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed:   { label: "Completed",    className: "bg-field text-forest" },
  in_progress: { label: "In progress",  className: "bg-forest text-paper" },
  active:      { label: "In progress",  className: "bg-forest text-paper" },
  upcoming:    { label: "Upcoming",     className: "bg-paper text-forest" },
  pending:     { label: "Upcoming",     className: "bg-paper text-forest" },
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function isPastDue(d: string | null, status: string) {
  if (!d || status === "completed") return false;
  return new Date(d) < new Date();
}

interface Props {
  step: PlanMilestone;
  isNext: boolean;
}

export default function MilestoneCard({ step, isNext }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const canComment = !step.isGoalDerived && !step.isCoastPoint;
  const { comments, adding, addComment, error } = useMilestoneComments(step.id, canComment);
  const badge = STATUS_BADGES[step.status] ?? STATUS_BADGES["upcoming"];
  const overdue = isPastDue(step.targetDate, step.status);
  const hasLongText = (step.notes?.length ?? 0) > 120;

  return (
    <div className="bg-surface rounded-[24px] p-5 space-y-3 text-forest">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold leading-none shrink-0", badge.className)}>
            {badge.label}
          </span>
          <h3 className="text-[16px] font-semibold text-forest">{step.title}</h3>
        </div>
        {step.targetDate && (
          <span className={cn("text-[12px] shrink-0 ml-2 whitespace-nowrap", overdue ? "text-clay-ink font-semibold" : "text-ink-40")}>
            {overdue ? `Due ${fmtDate(step.targetDate)} — overdue` : fmtDate(step.targetDate)}
          </span>
        )}
      </div>

      {/* Completed date */}
      {step.completedDate && (
        <p className="text-[12px] text-ink-40">Completed {fmtDate(step.completedDate)}</p>
      )}

      {/* Description */}
      {(step.notes || step.goalProgress) && (
        <div>
          {step.notes && (
            <p className={cn("text-[14px] text-ink-40 leading-[1.5]", !expanded && hasLongText && "line-clamp-3")}>
              {step.notes}
            </p>
          )}
          {hasLongText && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[13px] text-green font-semibold mt-1 hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          {step.goalProgress && (
            <div className={cn(step.notes && "mt-2")}>
              <p className="text-[14px] text-ink-40 tabular-nums mb-1.5">
                ${Math.round(step.goalProgress.currentAmount).toLocaleString()} of ${Math.round(step.goalProgress.targetAmount).toLocaleString()}
              </p>
              <div className="rounded-full bg-forest/15 h-2 max-w-[280px] overflow-hidden" aria-label={`${Math.round(step.goalProgress.progressPct)}% of ${step.title} funded`}>
                <div
                  className="h-full rounded-full bg-forest transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, step.goalProgress.progressPct))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Linked goal */}
      {step.linkedGoal && (
        <Link
          href="/client/goals/goals"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-field text-forest text-[12px] font-semibold hover:bg-field/80 transition-colors"
        >
          <Target className="h-3.5 w-3.5" /> {step.linkedGoal.title}
        </Link>
      )}

      {/* Action row */}
      {canComment && (
        <div className="flex items-center gap-3 pt-1 border-t border-hairline flex-wrap">
          <button
            onClick={() => { setShowAddComment(v => !v); setShowComments(true); }}
            className="flex items-center gap-1.5 min-h-11 text-[13px] font-semibold text-forest hover:underline underline-offset-2 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Add a comment
          </button>
          {comments.length > 0 && (
            <>
              <span className="text-ink-20" aria-hidden="true">·</span>
              <button
                onClick={() => setShowComments(v => !v)}
                className="flex items-center gap-1.5 min-h-11 text-[13px] font-semibold text-forest hover:underline underline-offset-2 transition-colors"
              >
                {comments.length} comment{comments.length !== 1 ? "s" : ""}
                {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Comments thread */}
      {canComment && showComments && <MilestoneComments comments={comments} />}
      {canComment && showAddComment && (
        <AddCommentForm
          milestoneId={step.id}
          onAdd={(c) => addComment(c).then(() => {})}
          error={error}
        />
      )}
    </div>
  );
}
