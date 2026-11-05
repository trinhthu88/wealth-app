import { useState } from "react";
import { TrendingUp, X } from "lucide-react";
import { Link } from "wouter";
import { useClientTrack } from "@/hooks/useClientTrack";
import CheckpointCard from "@/components/client/CheckpointCard";
import type { GoalStatus } from "@/hooks/useGoalProgress";

interface Props {
  goalId: string;
  goalTitle: string;
  status: GoalStatus;
}

export default function GoalScenarioCTA(props: Props) {
  const { isTrackA, loading } = useClientTrack();
  if (loading) return null;
  // Track A is past this checkpoint: for them this is a modelling shortcut, not an offer.
  return isTrackA
    ? <ModelGoal {...props} />
    : <CheckpointCard codes={["C3_off_track"]} goalId={props.goalId} className="mt-3" />;
}

function ModelGoal({ goalId, status }: Props) {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(`goal_cta_dismissed_${goalId}`) === "1"
  );
  if (dismissed) return null;
  if (status !== "at_risk" && status !== "off_track") return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(`goal_cta_dismissed_${goalId}`, "1");
  }

  return (
    <div className="mt-3 flex items-start gap-3 p-4 rounded-[16px] bg-sun-tint text-forest">
      <TrendingUp className="h-4 w-4 text-clay-ink shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-[13.5px] leading-[1.45] text-forest">
                    This goal needs attention. Run a scenario to see how adjusting your investment could get you back on track.{" "}
            <Link
              href={`/client/goals/what-if?goalId=${goalId}&type=retire_earlier`}
              className="font-semibold text-forest underline underline-offset-2 hover:no-underline"
            >
              Model this goal →
            </Link>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 -mt-2 -mr-2 h-11 w-11 flex items-center justify-center rounded-full text-forest/60 hover:text-forest transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
