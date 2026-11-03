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
    <div className="bg-surface rounded-[24px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        {isReviewOverdue ? (
          <span className="w-10 h-10 rounded-[14px] bg-sun text-forest flex items-center justify-center shrink-0"><AlertTriangle className="h-4 w-4" /></span>
        ) : (
          <span className="w-10 h-10 rounded-[14px] bg-field text-forest flex items-center justify-center shrink-0"><CalendarDays className="h-4 w-4" /></span>
        )}
        <div>
          <p className="text-[16px] font-semibold text-forest">Next review</p>
          {nextReviewDate ? (
            <p className={`text-[13.5px] mt-0.5 tabular-nums ${isReviewOverdue ? "text-clay-ink font-semibold" : "text-ink-40"}`}>
              {formatDate(nextReviewDate)} ·{" "}
              {isReviewOverdue
                ? `Overdue by ${Math.abs(daysUntilReview!)} days`
                : `${daysUntilReview} days away`}
            </p>
          ) : (
            <p className="text-[13.5px] text-ink-40 mt-0.5">
              No review date set. Ask your advisor to schedule one.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onRequestReview}
        className="flex-shrink-0 h-11 px-5 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[14px] font-semibold hover:bg-forest/5 transition-colors"
      >
        Request a review →
      </button>
    </div>
  );
}
