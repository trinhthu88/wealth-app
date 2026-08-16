import { useState } from "react";
import { TrendingUp, X } from "lucide-react";
import { Link } from "wouter";
import { useClientTrack } from "@/hooks/useClientTrack";
import type { GoalStatus } from "@/hooks/useGoalProgress";

interface Props {
  goalId: string;
  goalTitle: string;
  status: GoalStatus;
}

export default function GoalScenarioCTA({ goalId, goalTitle, status }: Props) {
  const { isTrackA, isTrackB, loading } = useClientTrack();
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(`goal_cta_dismissed_${goalId}`) === "1"
  );

  if (loading || dismissed) return null;
  if (status !== "at_risk" && status !== "off_track") return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(`goal_cta_dismissed_${goalId}`, "1");
  }

  return (
    <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
      <TrendingUp className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-xs text-amber-800">
        {isTrackA ? (
          <>
            This goal needs attention. Run a scenario to see how adjusting your investment could get you back on track.{" "}
            <Link
              href={`/client/scenarios?goalId=${goalId}&type=retire_earlier`}
              className="font-semibold text-[#1D9E75] hover:underline"
            >
              Model this goal →
            </Link>
          </>
        ) : (
          <>
            An advised investment plan could help accelerate "{goalTitle}".{" "}
            <Link href="/client/messages" className="font-semibold text-[#1D9E75] hover:underline">
              See how an advisor can help →
            </Link>
          </>
        )}
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 h-5 w-5 flex items-center justify-center text-amber-400 hover:text-amber-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
