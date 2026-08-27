import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import BottomNav from "@/components/BottomNav";
import Sol from "@/components/Sol";
import { MILESTONES, getEarnedMilestones, getStreak } from "@/lib/milestones";
import { Target, Flame } from "lucide-react";

export default function MilestonesPage() {
  const [earnedKeys, setEarnedKeys] = useState<string[]>([]);
  const [streakWeeks, setStreakWeeks] = useState(0);

  useEffect(() => {
    setEarnedKeys(getEarnedMilestones());
    setStreakWeeks(getStreak().weeks);
  }, []);

  const earned = MILESTONES.filter(m => earnedKeys.includes(m.key));
  const locked = MILESTONES.filter(m => !earnedKeys.includes(m.key));

  const streakBadges = ["streak_4", "streak_12"];
  const isStreakBadge = (key: string) => streakBadges.includes(key);

  return (
    <AppShell>
      <div className="pb-24 md:pb-0">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em]">
            Milestones
          </h1>
          {streakWeeks > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-sun-tint px-3 py-1.5">
              <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <span className="text-xs font-bold text-amber-ink tabular-nums">
                {streakWeeks} weeks
              </span>
            </div>
          )}
        </div>

        {/* Streak card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-[22px] mb-5 bg-forest p-5 shadow-[0_2px_14px_rgba(20,52,42,.06)]"
        >
          {/* Decorative dots */}
          <div className="absolute top-3 right-[60px] h-2 w-2 rounded-full bg-sun opacity-70" />
          <div className="absolute top-7 right-10 h-1.5 w-1.5 rounded-full bg-green opacity-60" />
          <div className="absolute bottom-4 right-[70px] h-1.5 w-1.5 rounded-full bg-clay opacity-50" />

          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <Sol size="sm" animate="idle" showFace />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-[17px] font-semibold text-paper leading-[1.3]">
                {streakWeeks > 0 ? `${streakWeeks}-week streak` : "Start your streak"}
              </p>
              <p className="text-xs text-mint mt-1 leading-[1.45]">
                {streakWeeks >= 4
                  ? "You're in the top 20% for consistency. Keep it up."
                  : streakWeeks > 0
                  ? `${4 - streakWeeks} more week${4 - streakWeeks !== 1 ? "s" : ""} to unlock the 4-week badge.`
                  : "Check in weekly to build your streak and unlock badges."}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Earned badges */}
        {earned.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-[15px] font-semibold text-forest mb-2.5">
              Earned · {earned.length} of {MILESTONES.length}
            </h2>
            <div className="grid grid-cols-3 gap-[10px]">
              {earned.map(m => (
                <motion.div
                  key={m.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-surface border border-hairline rounded-[20px] text-center p-3 shadow-[0_2px_14px_rgba(20,52,42,.06)]"
                >
                  <div className={`mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[12px] mb-2 ${isStreakBadge(m.key) ? "bg-sun-tint" : "bg-green-tint"}`}>
                    <Target className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                   <p className="text-[11px] font-semibold text-forest leading-[1.3]">{m.label}</p>
                   <p className="tala-eyebrow text-green mt-1">
                    Earned
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* In-progress: closest badges */}
        {locked.slice(0, 3).length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-[15px] font-semibold text-forest mb-2.5">
              Almost there
            </h2>
            <div className="grid grid-cols-3 gap-[10px]">
              {locked.slice(0, 3).map(m => (
                <div
                  key={m.key}
                  className="rounded-[20px] bg-sun-tint border-[1.5px] border-dashed border-sun shadow-[0_2px_8px_rgba(255,182,39,.12)] text-center p-3"
                >
                  <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[12px] mb-2 bg-sun/20">
                    <Target className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-[11px] font-semibold text-amber-ink leading-[1.3]">{m.label}</p>
                  <p className="tala-eyebrow text-amber-ink mt-1">
                    Not yet
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked badges */}
        {locked.slice(3).length > 0 && (
          <div>
            <h2 className="font-display text-[15px] font-semibold text-forest mb-2.5">
              Locked · {locked.slice(3).length} more
            </h2>
            <div className="grid grid-cols-3 gap-[10px]">
              {locked.slice(3).map(m => (
                <div
                  key={m.key}
                  className="bg-surface border border-hairline rounded-[20px] text-center p-3 opacity-50 shadow-[0_2px_14px_rgba(20,52,42,.04)]"
                >
                  <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[12px] mb-2 bg-hairline">
                    <Target className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-[11px] font-semibold text-forest leading-[1.3]">{m.label}</p>
                  <p className="tala-eyebrow text-ink-40 mt-1">
                    Locked
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty earned state */}
        {earned.length === 0 && (
          <div className="text-center py-4">
            <Sol size="md" animate="idle" showFace className="mx-auto mb-4" />
            <p className="font-display text-base font-semibold text-forest mb-1.5">
              Your badges await
            </p>
            <p className="text-[13px] text-ink-40 max-w-[220px] mx-auto mb-5 leading-[1.5]">
              Complete your pathway and track your budget to earn your first badge.
            </p>
            {/* Preview of first earnable badges */}
            <div className="grid grid-cols-3 gap-[10px] mt-2">
              {MILESTONES.slice(0, 3).map(m => (
                <div key={m.key} className="bg-surface border border-hairline rounded-[20px] text-center p-3 opacity-50 shadow-[0_2px_14px_rgba(20,52,42,.04)]">
                  <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[12px] mb-2 bg-hairline">
                    <Target className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="text-[11px] font-semibold text-forest leading-[1.3]">{m.label}</p>
                  <p className="tala-eyebrow text-ink-40 mt-1">Earn it</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </AppShell>
  );
}
