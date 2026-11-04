import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MILESTONES } from "@/lib/milestones";
import { Target, ClipboardList, Flame, Trophy, TrendingUp, Wallet, CheckCircle, Star, Sparkles, BarChart3, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  earnedKeys: string[];
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

export default function MilestoneChips({ earnedKeys, newlyEarned }: Props) {
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const newM = newlyEarned ? MILESTONES.find((m) => m.key === newlyEarned) : null;
  const NewMIcon = newM ? MILESTONE_ICON_MAP[newM.key] : null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {newM && NewMIcon && !celebrationDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            className="bg-breeze rounded-[24px] p-4 flex items-start gap-3"
            role="status"
            aria-live="polite"
          >
            <div className="w-10 h-10 rounded-[14px] bg-field text-forest flex-none flex items-center justify-center" aria-hidden="true">
              <NewMIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="tala-eyebrow text-forest">Achievement unlocked</div>
              <div className="text-[15px] font-semibold text-forest mt-1">{newM.label}</div>
              <div className="text-[14px] text-ink-40 leading-[1.5] mt-0.5">{newM.desc}</div>
            </div>
            <button
              type="button"
              onClick={() => setCelebrationDismissed(true)}
              className="-mr-2 -mt-2 h-11 w-11 rounded-full flex items-center justify-center text-forest hover:opacity-70"
              aria-label="Dismiss achievement notification"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="list" aria-label="Milestones">
        {MILESTONES.map((m) => {
          const isEarned = earnedKeys.includes(m.key);
          const Icon = MILESTONE_ICON_MAP[m.key] || Target;
          return (
            <div
              key={m.key}
              role="listitem"
              aria-label={`${m.label}: ${m.desc} — ${isEarned ? "earned" : "not yet earned"}`}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors",
                isEarned ? "bg-field text-forest" : "bg-surface text-ink-30",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {m.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
