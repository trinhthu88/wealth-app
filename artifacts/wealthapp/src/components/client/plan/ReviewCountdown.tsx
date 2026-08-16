import { CalendarDays, AlertTriangle } from "lucide-react";

interface Props {
  nextReviewDate: string | null;
  daysUntilReview: number | null;
  isReviewOverdue: boolean;
  onRequestReview: () => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReviewCountdown({ nextReviewDate, daysUntilReview, isReviewOverdue, onRequestReview }: Props) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        {isReviewOverdue ? (
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <CalendarDays className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="text-sm font-semibold text-[#042C53]">Next review</p>
          {nextReviewDate ? (
            <p className={`text-sm mt-0.5 ${isReviewOverdue ? "text-amber-600" : "text-slate-500"}`}>
              {formatDate(nextReviewDate)} ·{" "}
              {isReviewOverdue
                ? `Overdue by ${Math.abs(daysUntilReview!)} days ⚠`
                : `${daysUntilReview} days away`}
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-0.5">
              No review date set. Ask your advisor to schedule one.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onRequestReview}
        className="flex-shrink-0 px-4 py-2 rounded-xl border border-[#1D9E75] text-[#1D9E75] text-sm font-medium hover:bg-[#1D9E75]/5 transition-colors"
      >
        Request a review →
      </button>
    </div>
  );
}
