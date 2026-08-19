import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MILESTONES } from "@/lib/milestones";

interface Props {
  earnedKeys: string[];
  newlyEarned?: string | null;
}

export default function MilestoneChips({ earnedKeys, newlyEarned }: Props) {
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const newM = newlyEarned ? MILESTONES.find((m) => m.key === newlyEarned) : null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {newM && !celebrationDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3"
            role="status"
            aria-live="polite"
          >
            <div className="text-3xl" aria-hidden="true">{newM.emoji}</div>
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
              <span className={cn(!isEarned && "grayscale")} aria-hidden="true">{m.emoji}</span>
              {m.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
