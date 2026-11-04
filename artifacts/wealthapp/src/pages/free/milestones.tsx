// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Streak progress-bar width transition
// ✗ BANNED:  Page-load stagger on sections or badge tiles
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav or bottom padding hacks — FreeAppShell owns the menu bar

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { MILESTONES, getEarnedMilestones, getStreak } from "@/lib/milestones";
import { Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MilestonesPage() {
  const [earnedKeys, setEarnedKeys] = useState<string[]>([]);
  const [streakWeeks, setStreakWeeks] = useState(0);

  useEffect(() => {
    setEarnedKeys(getEarnedMilestones());
    setStreakWeeks(getStreak().weeks);
  }, []);

  const earned = MILESTONES.filter(m => earnedKeys.includes(m.key));
  const locked = MILESTONES.filter(m => !earnedKeys.includes(m.key));

  // Next streak badge: 4 weeks, then 12 weeks (the two streak milestones).
  const nextStreakTarget = streakWeeks < 4 ? 4 : streakWeeks < 12 ? 12 : null;
  const streakPct = nextStreakTarget ? Math.min(100, (streakWeeks / nextStreakTarget) * 100) : 100;
  const streakText = nextStreakTarget == null
    ? "You've earned both streak badges. Keep it going."
    : streakWeeks === 0
    ? "Check in weekly to build your streak and unlock badges."
    : `${nextStreakTarget - streakWeeks} more week${nextStreakTarget - streakWeeks !== 1 ? "s" : ""} earns the ${nextStreakTarget}-week badge.`;

  return (
    <AppShell>
      <div className="flex flex-col gap-3.5 pb-8">

        <section className="flex flex-col gap-1 px-1 pt-1">
          <span className="tala-eyebrow text-ink-40">Milestones</span>
          <h1 className="font-display text-[36px] leading-[1.05] text-forest tabular-nums mt-2">
            {earned.length} of {MILESTONES.length} badges
          </h1>
          <p className="text-[14px] text-ink-40 mt-1">
            {earned.length > 0 ? "Small habits that add up" : "The first ones come from setting a goal and finishing your pathway."}
          </p>
        </section>

        {/* Cobalt streak hero */}
        <section aria-label="Streak" className="bg-forest text-paper rounded-[28px] p-5 flex items-center gap-4">
          <span className="flex flex-col items-center flex-none min-w-[64px]">
            <span className="font-display tabular-nums text-[64px] leading-[0.85] tracking-[-0.045em] text-field">{streakWeeks}</span>
            <span className="text-[12px] font-semibold tracking-[0.1em] uppercase mt-1">{streakWeeks === 1 ? "Week" : "Weeks"}</span>
          </span>
          <span className="flex flex-col gap-1.5 flex-1 min-w-0">
            <span className="text-[17px] font-semibold">Check-in streak</span>
            <span className="text-[14px] text-mint leading-[1.45] text-pretty">{streakText}</span>
            <span className="h-2 rounded-full bg-paper/15 overflow-hidden mt-1" aria-hidden="true">
              <span className="block h-full rounded-full bg-field transition-[width] duration-500 ease-out" style={{ width: `${streakPct}%` }} />
            </span>
          </span>
        </section>

        {/* Earned badges */}
        {earned.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-[16px] font-semibold text-forest px-1 pt-1">Earned</h2>
            <div className="grid grid-cols-2 gap-3" role="list">
              {earned.map((m, i) => (
                <div
                  key={m.key}
                  role="listitem"
                  aria-label={`${m.label}: ${m.desc} — earned`}
                  className={cn("rounded-[24px] p-4 flex flex-col gap-2.5 min-h-[112px] text-forest", (Math.floor(i / 2) + i) % 2 === 0 ? "bg-field" : "bg-breeze")}
                >
                  <span className="w-9 h-9 rounded-[12px] bg-paper flex items-center justify-center" aria-hidden="true">
                    <Check className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold leading-[1.3]">{m.label}</span>
                    <span className="text-[12px] leading-[1.4] text-pretty">{m.desc}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Still to earn */}
        {locked.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-[16px] font-semibold text-forest px-1 pt-1">Still to earn</h2>
            <div className="bg-surface rounded-[28px] p-1 flex flex-col" role="list">
              {locked.map(m => (
                <div
                  key={m.key}
                  role="listitem"
                  aria-label={`${m.label}: ${m.desc} — locked`}
                  className="flex items-center gap-3 p-3 border-b border-hairline last:border-0 text-forest"
                >
                  <span className="w-10 h-10 shrink-0 rounded-[12px] bg-paper flex items-center justify-center" aria-hidden="true">
                    <Lock className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-[15px] font-semibold">{m.label}</span>
                    <span className="text-[13px] text-ink-40 text-pretty">{m.desc}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </AppShell>
  );
}
