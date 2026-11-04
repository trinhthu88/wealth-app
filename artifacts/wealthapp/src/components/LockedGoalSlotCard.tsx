import { ArrowUpRight, Lock } from "lucide-react";
import Sol from "@/components/Sol";
import { track } from "@/lib/analytics";

/**
 * A persistent, non-dismissible placeholder representing a free user's locked
 * 2nd goal slot. Distinct from SmartUpgradeCard (a dismissible tip/banner) —
 * this is a structural UI element showing what the plan cap is actually hiding.
 */
export default function LockedGoalSlotCard() {
  return (
    <div className="rounded-[24px] p-5 bg-breeze text-forest">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Sol size="sm" animate="breathe" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="tala-eyebrow text-forest/70 flex items-center gap-1.5">
            <Lock className="h-3 w-3" aria-hidden="true" />Your 2nd goal slot
          </div>
          <p className="text-[16px] font-medium leading-[1.4] mt-1 text-pretty">
            The free plan tracks one goal. Upgrading lets you track as many as you need, side by side.
          </p>
          <a
            href="/book"
            onClick={() => track("upgrade_cta_clicked", { location: "locked_goal_slot_card" })}
            className="mt-4 inline-flex items-center gap-1.5 h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Unlock with upgrade <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
