import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

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
          <p className="text-xs text-ink-40 mt-0.5">Free plan is limited to 1 goal. Upgrade to track as many as you need.</p>
          <Button variant="outline" size="sm" className="mt-3 text-xs border-primary text-primary hover:bg-primary/5" asChild>
            <a href="/book" onClick={() => track("upgrade_cta_clicked", { location: "locked_goal_slot_card" })}>Unlock with upgrade →</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
