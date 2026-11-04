import { useState } from "react";
import { TrendingUp, X } from "lucide-react";
import { Link } from "wouter";
import { useClientTrack } from "@/hooks/useClientTrack";
import { useCreateLeadFromInterest } from "@/hooks/useCreateLeadFromInterest";
import { track } from "@/lib/analytics";
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
  const createLead = useCreateLeadFromInterest();

  if (loading || dismissed) return null;
  if (status !== "at_risk" && status !== "off_track") return null;

  // These are in-app routes (wouter Link) — no page unload, so firing this
  // without awaiting it doesn't risk the request being aborted.
  function markInterest() {
    createLead.mutate("C3_off_track");
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(`goal_cta_dismissed_${goalId}`, "1");
  }

  return (
    <div className="mt-3 flex items-start gap-3 p-4 rounded-[16px] bg-sun-tint text-forest">
      <TrendingUp className="h-4 w-4 text-clay-ink shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-[13.5px] leading-[1.45] text-forest">
        {isTrackA ? (
          <>
            This goal needs attention. Run a scenario to see how adjusting your investment could get you back on track.{" "}
            <Link
              href={`/client/goals/what-if?goalId=${goalId}&type=retire_earlier`}
              onClick={markInterest}
              className="font-semibold text-forest underline underline-offset-2 hover:no-underline"
            >
              Model this goal →
            </Link>
          </>
        ) : (
          <>
            An advised investment plan could help accelerate "{goalTitle}".{" "}
            <Link
              href="/client/advisor/messages"
              onClick={() => { markInterest(); track("upgrade_cta_clicked", { location: "goal_scenario_cta" }); }}
              className="font-semibold text-forest underline underline-offset-2 hover:no-underline"
            >
              See how an advisor can help →
            </Link>
          </>
        )}
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
