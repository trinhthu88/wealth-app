import { ArrowUpRight, Lock } from "lucide-react";
import { Link } from "wouter";
import { track } from "@/lib/analytics";
import CheckpointCard from "@/components/client/CheckpointCard";

/** Show the free-plan locked slot and retain the server's dismissible C2 offer. */
export default function LockedGoalSlotCard({ isFree = false }: { isFree?: boolean }) {
  return (
    <>
      {isFree && (
        <Link
          href="/free/advisor"
          onClick={() => track("upgrade_cta_clicked", { location: "locked_goal_slot_card" })}
          className="flex items-center gap-3.5 rounded-[28px] bg-surface p-5 text-forest transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-breeze" aria-hidden="true">
            <Lock className="h-6 w-6" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[16px] font-semibold">Your 2nd goal slot</span>
            <span className="text-[13px] leading-[1.45] text-ink-40 text-pretty">
              Free plan tracks one goal. Advised clients track as many as they need.
            </span>
          </span>
          <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
        </Link>
      )}
      <CheckpointCard codes={["C2_goal_slot"]} />
    </>
  );
}
