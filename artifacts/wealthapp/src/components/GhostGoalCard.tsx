import { Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
 */
export default function GhostGoalCard({ icon: Icon, title, description, targetLabel }: Props) {
  return (
    <a href="/book" onClick={() => track("upgrade_cta_clicked", { location: "ghost_goal_card" })} className="relative block rounded-2xl border border-hairline bg-surface p-5 overflow-hidden">
      <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-surface/50">
        <span className="flex items-center gap-1.5 rounded-full bg-green text-white text-[11px] font-semibold px-3 py-1.5">
          <Lock className="h-3 w-3" />Unlock as a client
        </span>
      </div>
      <div className="flex items-start gap-3 opacity-40 select-none pointer-events-none">
        <Icon className="h-6 w-6 text-forest flex-shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-forest">{title}</p>
          <p className="text-[12px] text-ink-40 mt-0.5">{description}</p>
          <p className="text-[15px] font-bold text-green mt-1">{targetLabel}</p>
        </div>
      </div>
    </a>
  );
}
