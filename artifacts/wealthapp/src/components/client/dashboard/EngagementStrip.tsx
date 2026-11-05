import { Flame } from "lucide-react";
import MilestoneChips from "@/components/MilestoneChips";
import { useEngagement } from "@/hooks/useEngagement";

/** Streak and milestones, from the server. */
export default function EngagementStrip() {
  const { data } = useEngagement();
  if (!data || (data.streakWeeks === 0 && data.milestones.length === 0)) return null;
  return (
    <section className="space-y-3 rounded-[24px] bg-surface p-5" data-testid="engagement-strip">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-forest">
        <Flame className="h-4 w-4" aria-hidden="true" />
        {data.streakWeeks === 1 ? "1 week in a row" : `${data.streakWeeks} weeks in a row`}
      </p>
      <MilestoneChips earnedKeys={data.milestones} />
    </section>
  );
}
