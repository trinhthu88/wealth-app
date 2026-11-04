import { Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { track } from "@/lib/analytics";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  targetLabel: string;
}

/**
 * A blurred, non-interactive preview of a goal a free user hasn't set up —
 * distinct from LockedGoalSlotCard (announces the cap itself), this shows
 * what a specific unlocked goal would look like to make the upgrade concrete.
 * Links to the Advisor tab, the free plan's upgrade destination.
 */
export default function GhostGoalCard({ icon: Icon, title, description, targetLabel }: Props) {
  return (
    <Link
      href="/free/advisor"
      onClick={() => track("upgrade_cta_clicked", { location: "ghost_goal_card" })}
      className="relative block rounded-[24px] bg-surface p-5 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
    >
      <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-surface/50">
        <span className="inline-flex items-center gap-1.5 h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper">
          <Lock className="h-4 w-4" aria-hidden="true" />Unlock with an advisor
        </span>
      </div>
      <div className="opacity-40 select-none pointer-events-none" aria-hidden="true">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 shrink-0 rounded-[14px] bg-breeze text-forest flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-forest leading-tight truncate">{title}</h3>
            <p className="text-[13px] text-ink-40 mt-0.5 truncate">{description}</p>
          </div>
        </div>
        <p className="font-display tabular-nums text-[32px] leading-none tracking-[-0.03em] text-forest mt-4">{targetLabel}</p>
      </div>
    </Link>
  );
}
