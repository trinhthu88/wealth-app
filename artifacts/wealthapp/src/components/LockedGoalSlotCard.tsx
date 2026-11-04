import { ArrowUpRight, Lock } from "lucide-react";
import { Link } from "wouter";
import { track } from "@/lib/analytics";

/**
 * A persistent, non-dismissible placeholder representing a free user's locked
 * 2nd goal slot. Distinct from SmartUpgradeCard (a dismissible tip/banner) —
 * this is a structural UI element showing what the plan cap is actually hiding.
 * The whole row links to the Advisor tab, the free plan's upgrade destination.
 */
export default function LockedGoalSlotCard() {
  return (
    <Link
      href="/free/advisor"
      onClick={() => track("upgrade_cta_clicked", { location: "locked_goal_slot_card" })}
      className="flex items-center gap-3.5 rounded-[28px] bg-surface p-5 text-forest transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
    >
      <span className="w-14 h-14 shrink-0 rounded-[16px] bg-breeze flex items-center justify-center" aria-hidden="true">
        <Lock className="h-6 w-6" />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[16px] font-semibold">Your 2nd goal slot</span>
        <span className="text-[13px] leading-[1.45] text-ink-40 text-pretty">
          Free plan tracks one goal. Advised clients track as many as they need.
        </span>
      </span>
      <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
    </Link>
  );
}
