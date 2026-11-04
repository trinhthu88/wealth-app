import { Lock } from "lucide-react";
import TalkToAdvisorButton from "@/components/TalkToAdvisorButton";

/**
 * A persistent, non-dismissible placeholder representing a free user's locked
 * 2nd goal slot. Distinct from SmartUpgradeCard (a dismissible tip/banner) —
 * this is a structural UI element showing what the plan cap is actually hiding.
 */
export default function LockedGoalSlotCard() {
  return (
    <div className="rounded-2xl p-5 grayscale opacity-70 bg-hairline border-[1.5px] border-dashed border-hairline">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center rounded-xl w-10 h-10 bg-green-tint">
          <Lock className="h-4 w-4 text-green" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-forest leading-[1.4]">
            Your 2nd goal slot
          </p>
          <p className="text-xs text-ink-40 mt-0.5">The free plan covers 1 active goal. An advisor can plan every goal with you.</p>
          <TalkToAdvisorButton
            source="C2_goal_slot"
            location="locked_goal_slot_card"
            className="mt-3 inline-flex items-center rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
