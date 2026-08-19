import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MILESTONES } from "@/lib/milestones";
import { Target, ClipboardList, Flame, Trophy, TrendingUp, Wallet, CheckCircle, Star, Sparkles, BarChart3 } from "lucide-react";

interface Props {
  earnedKeys: string[];
  newlyEarned?: string | null;
}

const ICON_MAP: Record<string, any> = {
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
  const NewMIcon = newM ? ICON_MAP[newM.key] : null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {newM && NewMIcon && !celebrationDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3"
            role="status"
            aria-live="polite"
          >
            <div className="text-3xl text-emerald-600" aria-hidden="true">
              <NewMIcon className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-emerald-800">
                Achievement unlocked: {newM.label}
              </div>
              <div className="text-sm text-emerald-700 mt-0.5">{newM.desc}</div>
            </div>
            <button
              onClick={() => setCelebrationDismissed(true)}
              className="text-emerald-500 hover:text-emerald-700 text-lg leading-none"
              aria-label="Dismiss achievement notification"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="list" aria-label="Milestones">
        {MILESTONES.map((m) => {
          const isEarned = earnedKeys.includes(m.key);
          const Icon = ICON_MAP[m.key] || Target;
          return (
            <div
              key={m.key}
              role="listitem"
              aria-label={`${m.label}: ${m.desc} — ${isEarned ? "earned" : "not yet earned"}`}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                isEarned
                  ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                  : "bg-muted/40 border-border text-muted-foreground grayscale opacity-60",
              )}
            >
              <Icon className={cn("h-4 w-4", !isEarned && "grayscale opacity-50")} aria-hidden="true" />
              {m.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
