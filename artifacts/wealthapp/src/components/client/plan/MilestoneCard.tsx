import { useState } from "react";
import { Link } from "wouter";
import { MessageSquare, ChevronDown, ChevronUp, Target } from "lucide-react";
import MilestoneComments from "./MilestoneComments";
import AddCommentForm from "./AddCommentForm";
import { useMilestoneComments } from "@/hooks/useMilestoneComments";
import { cn } from "@/lib/utils";
import type { PlanMilestone } from "@/hooks/usePlan";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed:   { label: "Completed",  className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  in_progress: { label: "In progress",  className: "bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20" },
  active:      { label: "In progress",  className: "bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20" },
  upcoming:    { label: "Upcoming",     className: "bg-slate-100 text-slate-500 border border-slate-200" },
  pending:     { label: "Upcoming",     className: "bg-slate-100 text-slate-500 border border-slate-200" },
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
  statusGroup: (s: string) => string;
}

export default function MilestoneCard({ step, isNext, statusGroup }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const canComment = !step.isGoalDerived && !step.isCoastPoint;
  const { comments, adding, addComment, error } = useMilestoneComments(step.id, canComment);
  const badge = STATUS_BADGES[step.status] ?? STATUS_BADGES["upcoming"];
  const overdue = isPastDue(step.targetDate, step.status);
  const hasLongText = (step.notes?.length ?? 0) > 120;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0", badge.className)}>
            {badge.label}
          </span>
          <h3 className="text-sm font-semibold text-[#042C53]">{step.title}</h3>
        </div>
        {step.targetDate && (
          <span className={cn("text-xs shrink-0 ml-2 whitespace-nowrap", overdue ? "text-amber-600 font-medium" : "text-slate-400")}>
            {overdue ? `Due ${fmtDate(step.targetDate)} — overdue` : fmtDate(step.targetDate)}
          </span>
        )}
      </div>

      {/* Completed date */}
      {step.completedDate && (
        <p className="text-xs text-emerald-600">Completed {fmtDate(step.completedDate)}</p>
      )}

      {/* Description */}
      {(step.notes || step.goalProgress) && (
        <div>
          <p className={cn("text-sm text-slate-500", !expanded && hasLongText && "line-clamp-3")}>
            {step.notes}
            {step.notes && step.goalProgress ? " · " : ""}
            {step.goalProgress
              ? statusGroup(step.status) === "in_progress"
                ? `$${Math.round(step.goalProgress.currentAmount).toLocaleString()} of $${Math.round(step.goalProgress.targetAmount).toLocaleString()}`
                : `$${Math.round(step.goalProgress.targetAmount).toLocaleString()}${statusGroup(step.status) === "upcoming" ? " target" : ""}`
              : ""}
          </p>
          {hasLongText && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-[#1D9E75] font-medium mt-1 hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {/* Linked goal */}
      {step.linkedGoal && (
        <Link
          href="/client/goals"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] text-xs font-medium hover:bg-[#1D9E75]/20 transition-colors"
        >
          <Target className="h-3.5 w-3.5" /> {step.linkedGoal.title}
        </Link>
      )}

      {/* Action row */}
      {canComment && (
        <div className="flex items-center gap-3 pt-1 border-t border-slate-50 flex-wrap">
          <button
            onClick={() => { setShowAddComment(v => !v); setShowComments(true); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#1D9E75] transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Add a comment
          </button>
          {comments.length > 0 && (
            <>
              <span className="text-slate-200">·</span>
              <button
                onClick={() => setShowComments(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#042C53] transition-colors"
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
