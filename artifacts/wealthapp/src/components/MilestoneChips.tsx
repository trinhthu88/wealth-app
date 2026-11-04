import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MILESTONES } from "@/lib/milestones";
import { Target, ClipboardList, Flame, Trophy, TrendingUp, Wallet, CheckCircle, Star, Sparkles, BarChart3, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  earnedKeys: string[];
  /** When set, the strip is shown as an "Achievement unlocked" celebration card.
   *  Dismissing the celebration hides the whole card. */
  newlyEarned?: string | null;
}

export const MILESTONE_ICON_MAP: Record<string, LucideIcon> = {
  goal_setter: Target,
  plan_starter: ClipboardList,
  streak_4: Flame,
  streak_12: Trophy,
  net_worth_pos: TrendingUp,
  saver_20: Wallet,
  goal_on_track: CheckCircle,
  score_70: Star,
  score_80: Sparkles,
  budget_3months: BarChart3,
};

function ChipStrip({ earnedKeys, onTint = false }: { earnedKeys: string[]; onTint?: boolean }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="list" aria-label="Milestones">
      {MILESTONES.map((m) => {
        const isEarned = earnedKeys.includes(m.key);
        const Icon = MILESTONE_ICON_MAP[m.key] || Target;
        return (
          <div
            key={m.key}
            role="listitem"
            aria-label={`${m.label}: ${m.desc} — ${isEarned ? "earned" : "not yet earned"}`}
            className={cn(
              "flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
              isEarned
                ? "bg-field text-forest"
                : onTint
                ? "border-[1.5px] border-forest/20 text-forest/60"
                : "border-[1.5px] border-hairline-2 text-ink-40",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {m.label}
          </div>
        );
      })}
    </div>
  );
}

export default function MilestoneChips({ earnedKeys, newlyEarned }: Props) {
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const newM = newlyEarned ? MILESTONES.find((m) => m.key === newlyEarned) : null;
  const NewMIcon = newM ? MILESTONE_ICON_MAP[newM.key] ?? Target : null;

  // Plain strip — no celebration requested.
  if (!newM || !NewMIcon) return <ChipStrip earnedKeys={earnedKeys} />;

  return (
    <AnimatePresence>
      {!celebrationDismissed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -8 }}
          className="relative space-y-3 rounded-[24px] bg-breeze p-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 pr-10">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-field text-forest" aria-hidden="true">
              <NewMIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="tala-eyebrow text-forest">Achievement unlocked</div>
              <div className="mt-1 text-[15px] font-semibold text-forest">{newM.label}</div>
              <div className="mt-0.5 text-[13px] leading-[1.5] text-forest text-pretty">{newM.desc}</div>
            </div>
          </div>
          <ChipStrip earnedKeys={earnedKeys} onTint />
          <button
            type="button"
            onClick={() => setCelebrationDismissed(true)}
            className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/10"
            aria-label="Dismiss achievement notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
