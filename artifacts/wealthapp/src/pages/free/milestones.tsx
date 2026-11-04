// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Sol idle/breathe animation
// ✗ BANNED:  Page-load stagger on sections or badge tiles
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav or bottom padding hacks — FreeAppShell owns the menu bar

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import SolNarration from "@/components/client/SolNarration";
import { MILESTONE_ICON_MAP } from "@/components/MilestoneChips";
import { MILESTONES, getEarnedMilestones, getStreak } from "@/lib/milestones";
import { Target, Flame, Lock, Check } from "lucide-react";
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

  const solLine = earned.length > 0
    ? `You've earned ${earned.length} of ${MILESTONES.length} badges${streakWeeks > 0 ? `, with a ${streakWeeks}-week check-in streak running` : ""}.`
    : "No badges yet — the first ones come from setting a goal and finishing your pathway.";

  const streakText = streakWeeks >= 4
    ? "You're in the top 20% for consistency. Keep it up."
    : streakWeeks > 0
    ? `${4 - streakWeeks} more week${4 - streakWeeks !== 1 ? "s" : ""} to unlock the 4-week badge.`
    : "Check in weekly to build your streak and unlock badges.";

  return (
    <AppShell>
      <div className="pb-8 space-y-4">

        <SolNarration
          line={solLine}
          detail="Badges mark the habits that move your money forward: setting goals, checking in each week, saving consistently and keeping your health score up."
        />

        {/* Header: title + the one focal count */}
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] text-forest">Milestones</h1>
          <div className="mt-3 flex items-baseline gap-2" aria-label={`${earned.length} of ${MILESTONES.length} badges earned`}>
            <span className="font-display tabular-nums text-[56px] leading-none tracking-[-0.04em] text-forest">
              {earned.length}
            </span>
            <span className="font-display tabular-nums text-[24px] leading-none text-ink-40">
              of {MILESTONES.length}
            </span>
          </div>
          <p className="text-[14px] text-ink-40 leading-[1.5] mt-2">badges earned</p>
        </div>

        {/* Streak */}
        <div className="bg-surface rounded-[24px] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-[14px] bg-field text-forest flex-none flex items-center justify-center" aria-hidden="true">
            <Flame className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-forest">
              {streakWeeks > 0 ? (
                <><span className="tabular-nums">{streakWeeks}</span>-week streak</>
              ) : "Start your streak"}
            </h3>
            <p className="text-[14px] text-ink-40 leading-[1.5] text-pretty mt-0.5">{streakText}</p>
          </div>
        </div>

        {/* Earned badges */}
        {earned.length > 0 && (
          <section>
            <h2 className="font-sans text-[16px] font-semibold text-forest mb-3">Earned</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="list">
              {earned.map(m => <BadgeTile key={m.key} milestoneKey={m.key} label={m.label} desc={m.desc} earned />)}
            </div>
          </section>
        )}

        {/* Locked badges */}
        {locked.length > 0 && (
          <section>
            <h2 className="font-sans text-[16px] font-semibold text-forest mb-3">
              Still to earn · <span className="tabular-nums">{locked.length}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="list">
              {locked.map(m => <BadgeTile key={m.key} milestoneKey={m.key} label={m.label} desc={m.desc} earned={false} />)}
            </div>
          </section>
        )}

      </div>
    </AppShell>
  );
}

function BadgeTile({ milestoneKey, label, desc, earned }: { milestoneKey: string; label: string; desc: string; earned: boolean }) {
  const Icon = MILESTONE_ICON_MAP[milestoneKey] ?? Target;
  return (
    <div
      role="listitem"
      aria-label={`${label}: ${desc} — ${earned ? "earned" : "locked"}`}
      className={cn("relative rounded-[24px] p-4 flex flex-col", earned ? "bg-field" : "bg-surface")}
    >
      {!earned && (
        <Lock className="absolute top-4 right-4 h-4 w-4 text-ink-30" aria-hidden="true" />
      )}
      <div
        className={cn(
          "w-10 h-10 rounded-[14px] flex items-center justify-center",
          earned ? "bg-paper text-forest" : "bg-paper text-ink-30",
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className={cn("text-[14px] font-semibold leading-[1.3] mt-3", earned ? "text-forest" : "text-ink-40")}>{label}</h3>
      <p className={cn("text-[12px] leading-[1.45] mt-1 text-pretty", earned ? "text-forest/80" : "text-ink-30")}>{desc}</p>
      <div className={cn("tala-eyebrow mt-3 flex items-center gap-1", earned ? "text-forest" : "text-ink-30")}>
        {earned ? <><Check className="h-3 w-3" aria-hidden="true" /> Earned</> : "Locked"}
      </div>
    </div>
  );
}
