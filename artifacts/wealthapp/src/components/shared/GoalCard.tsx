// ANIMATION RULES FOR THIS COMPONENT:
// ✓ ALLOWED: Progress-bar width transition, arrow rotate on expand
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Pale status tints (sun-tint / green-tint) — tiles use full field / breeze / sun

import { useState } from "react";
import { cn } from "@/lib/utils";
import Sol from "@/components/Sol";
import TalkToAdvisorButton from "@/components/TalkToAdvisorButton";
import CurrencyField from "@/components/shared/CurrencyField";
import GoalStatusBadge from "@/components/client/goals/GoalStatusBadge";
import type { GoalStatus } from "@/hooks/useGoalProgress";
import type { ProjectionResult } from "@/lib/goalProjection";
import {
  MoreHorizontal, Pencil, Pause, Trash2, CheckCircle2, PlusCircle, TrendingUp, ArrowUpRight,
} from "lucide-react";

/**
 * Free tier's goal.status / ProjectionResult.status use a 4-value vocabulary
 * ("on_track" | "almost" | "off_track" | "achieved") distinct from the
 * client-tier's pacing-derived GoalStatus. Callers on the free tier adapt
 * through this before building GoalCardData.
 */
export function toTrackStatus(status: string): GoalStatus {
  switch (status) {
    case "on_track": return "on_track";
    case "almost": return "at_risk";
    case "achieved": return "completed";
    case "off_track": return "off_track";
    default: return "no_target";
  }
}

interface FreeTierGoal {
  id: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate?: string | null;
}

/** Adapts a free-tier goal record (+ its own status vocabulary) into this component's data shape. */
export function toGoalCardData(goal: FreeTierGoal, status: string, accountsBalance = 0): GoalCardData {
  const current = parseFloat(goal.currentAmount ?? "0");
  const target = goal.targetAmount ? parseFloat(goal.targetAmount) : null;
  const totalTowardGoal = current + accountsBalance;
  return {
    id: goal.id,
    title: goal.title,
    goalType: goal.goalType,
    targetAmountNum: target,
    computedCurrentAmount: totalTowardGoal,
    targetDate: goal.targetDate ?? null,
    trackStatus: toTrackStatus(status),
    progressPct: target && target > 0 ? Math.min(100, Math.round((totalTowardGoal / target) * 100)) : 0,
  };
}

export interface GoalCardData {
  id: string;
  title: string;
  goalType: string;
  targetAmountNum: number | null;
  computedCurrentAmount: number;
  targetDate: string | null;
  /** Pacing status, already in the client-tier vocabulary. */
  trackStatus: GoalStatus;
  progressPct: number | null;
  /** Present (possibly empty) only for goals that can have linked holdings — client tier. */
  linkCount?: number;
}

interface Props {
  goal: GoalCardData;
  onEdit: () => void;
  /** Providing this enables the "..." menu (edit/pause/delete) — client tier's pattern.
   * Free tier omits it and keeps its own delete-confirm UI outside the card. */
  onDelete?: (id: string) => void;
  /** Providing this enables the "Mark complete" action row item — client tier only. */
  onMarkComplete?: (id: string) => void;

  // ── Free-tier superset: projection breakdown, growth chip, advisor CTA ──
  /** When present the card becomes expandable: tapping it opens the projection
   * block (what-if amounts, monthly breakdown, advisor CTA, contribute/edit). */
  projection?: ProjectionResult;
  accountsBalance?: number;
  onContribute?: () => void;
  /** Start with the projection block open (free tier, single goal). */
  defaultExpanded?: boolean;

  /** Client-tier extras that depend on hooks (Sol nudges, holding-links panel,
   * scenario CTA) — rendered by the caller, not this component, so this stays
   * a pure presentational shell. Rendered below the core card content. */
  children?: React.ReactNode;

  className?: string;
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function roundNice(n: number) {
  const step = n >= 1000 ? 50 : n >= 100 ? 10 : 1;
  return Math.max(step, Math.round(n / step) * step);
}

function GrowthChip({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1.5 w-fit bg-paper text-forest">
      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="tabular-nums">+{fmtCompact(amount)}/month from savings interest &amp; investment returns</span>
    </div>
  );
}

/** GoalDetail "If you put in each month" block — illustration from the real
 * amount still needed and months remaining; counts contributions only. */
function WhatIfBlock({ projection, targetDateStr }: { projection: ProjectionResult; targetDateStr: string | null }) {
  const required = projection.requiredMonthlySaving;
  const options = Array.from(new Set([0.75, 1, 1.25, 1.5].map(f => roundNice(required * f))));
  const [monthly, setMonthly] = useState(options[Math.min(1, options.length - 1)]);
  if (!(required > 0) || projection.amountStillNeeded <= 0) return null;

  const months = Math.ceil(projection.amountStillNeeded / monthly);
  const reach = new Date();
  reach.setMonth(reach.getMonth() + months);
  const reachLabel = reach.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const late = months - projection.monthsRemaining;
  const note = late <= 0
    ? (targetDateStr ? `in time for ${targetDateStr}` : "in time for your target")
    : `${late} month${late === 1 ? "" : "s"} after your target`;

  return (
    <div className="bg-paper rounded-[20px] p-4 flex flex-col gap-3">
      <span className="tala-eyebrow text-ink-40">If you put in each month</span>
      <div role="group" aria-label="Monthly amount" className="flex flex-wrap gap-1.5">
        {options.map(v => (
          <button
            key={v}
            type="button"
            aria-pressed={monthly === v}
            onClick={() => setMonthly(v)}
            className={cn(
              "h-10 rounded-full px-4 text-[14px] font-semibold tabular-nums transition-colors",
              monthly === v ? "bg-forest text-paper" : "border-[1.5px] border-forest text-forest",
            )}
          >
            <CurrencyField amountUsd={v} compact />
          </button>
        ))}
      </div>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-display tabular-nums text-[40px] leading-[0.9] tracking-[-0.03em] text-forest">{reachLabel}</span>
        <span className="text-[14px] font-semibold text-forest">{note}</span>
      </div>
      <span className="text-[13px] leading-[1.45] text-ink-40">Illustration only — counts what you put in, not returns.</span>
    </div>
  );
}

function BreakdownRows({ projection, currentMonthlyPace }: { projection: ProjectionResult; currentMonthlyPace: number }) {
  const isOffTrack = !projection.onTrack;
  const rows = [
    { label: "Months remaining", value: `${projection.monthsRemaining} mo` },
    { label: "Needed each month", value: fmtCompact(projection.requiredMonthlySaving) },
    { label: "Your pace now", value: fmtCompact(currentMonthlyPace) },
    ...(isOffTrack && projection.monthlyShortfall > 0 ? [{ label: "Monthly shortfall", value: `-${fmtCompact(projection.monthlyShortfall)}`, red: true }] : []),
    { label: "Projected at target date", value: fmtCompact(projection.projectedAmount) },
  ];
  return (
    <div className="bg-paper rounded-[20px] p-1">
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-3.5 text-[14px] border-b border-hairline last:border-0">
          <span className="text-forest">{r.label}</span>
          <span className={cn("font-semibold tabular-nums", r.red ? "text-clay-ink" : "text-forest")}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function AdvisorCTA({ offTrack, shortfall }: { offTrack: boolean; shortfall: number }) {
  return (
    <TalkToAdvisorButton
      source="C3_off_track"
      location="goal_card"
      className="w-full bg-breeze rounded-[20px] px-4 py-4 flex items-center gap-3.5 text-left text-forest transition-opacity hover:opacity-90"
    >
      <div className="shrink-0"><Sol size="sm" animate="breathe" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-[1.35]">
          {offTrack ? "This gap needs a professional strategy" : "Small optimisations could close this gap"}
        </p>
        <p className="text-[13px] leading-[1.45] mt-1 text-pretty">
          {offTrack && shortfall > 0
            ? <>A <span className="tabular-nums">{fmtCompact(shortfall)}</span> shortfall is solvable with the right investment plan. An advisor can model it with you.</>
            : "An advisor can identify small adjustments to get you fully on track."}
        </p>
      </div>
      <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
    </TalkToAdvisorButton>
  );
}

type Tone = "field" | "breeze" | "sun" | "surface";

/** Full-strength tile colour follows pacing: Spring Field on track, Blue Breeze
 * when ahead or done, Sunset Pop when the goal needs attention, plain surface
 * when there's no target to pace against. */
function toneFor(goal: GoalCardData, projection?: ProjectionResult): Tone {
  switch (goal.trackStatus) {
    case "at_risk":
    case "off_track": return "sun";
    case "completed": return "breeze";
    case "on_track":
      return projection && goal.targetAmountNum && projection.projectedAmount >= goal.targetAmountNum * 1.1 ? "breeze" : "field";
    default: return "surface";
  }
}

const TONE_BG: Record<Tone, string> = {
  field: "bg-field", breeze: "bg-breeze", sun: "bg-sun", surface: "bg-surface",
};

export default function GoalCard({
  goal, onEdit, onDelete, onMarkComplete, projection, accountsBalance: _accountsBalance, onContribute, defaultExpanded = false, children, className,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasTarget = goal.targetAmountNum != null && goal.targetAmountNum > 0;
  const pct = Math.min(100, Math.max(0, goal.progressPct ?? 0));
  const targetDateStr = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  const needsAttention = goal.trackStatus === "off_track" || goal.trackStatus === "at_risk";
  const tone = toneFor(goal, projection);
  const isAhead = tone === "breeze" && goal.trackStatus === "on_track";

  const growthAmount = projection?.monthlyGrowthFromReturns ?? 0;
  const currentMonthlyPace = (projection?.currentMonthlyCash ?? 0) + (projection?.monthlyGrowthFromReturns ?? 0);
  const hasMenu = !!onDelete;
  // Free tier (projection present, no menu): tapping the tile opens the detail
  // block in place. Otherwise the tile keeps its tap-to-edit contract.
  const expandable = !!projection && !hasMenu;
  const onTileActivate = expandable ? () => setExpanded(v => !v) : onEdit;

  return (
    <div className={cn("relative rounded-[28px] p-5 text-forest", TONE_BG[tone], className)}>
      <div
        className="cursor-pointer rounded-[20px] flex flex-col gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        onClick={onTileActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTileActivate(); } }}
        aria-label={expandable ? `${goal.title} — ${expanded ? "hide" : "show"} details` : `Edit ${goal.title}`}
        aria-expanded={expandable ? expanded : undefined}
      >
        <div className="flex items-center justify-between gap-2 min-h-11 pr-12">
          <h3 className="text-[17px] font-semibold leading-tight truncate min-w-0">{goal.title}</h3>
        </div>

        <div className="flex items-end justify-between gap-2">
          {hasTarget ? (
            <span className="font-display tabular-nums text-[48px] leading-[0.9] tracking-[-0.03em]">{Math.round(pct)}%</span>
          ) : (
            <span className="font-display tabular-nums text-[32px] leading-none tracking-[-0.03em]">
              <CurrencyField amountUsd={goal.computedCurrentAmount} />
            </span>
          )}
          {isAhead ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold leading-none shrink-0 bg-forest text-paper">Ahead</span>
          ) : (
            // On a Sunset tile the attention pill flips to Cobalt so it stays visible.
            <span className={cn(needsAttention && "[&>span]:bg-forest [&>span]:text-paper")}>
              <GoalStatusBadge status={goal.trackStatus} />
            </span>
          )}
        </div>

        {hasTarget ? (
          <>
            <div className="h-2 rounded-full bg-forest/15 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-forest transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[14px] font-semibold tabular-nums">
              <CurrencyField amountUsd={goal.computedCurrentAmount} compact /> of <CurrencyField amountUsd={goal.targetAmountNum!} compact />
              {targetDateStr && <> · by {targetDateStr}</>}
            </div>
          </>
        ) : (
          <div className="text-[14px] font-semibold">
            {targetDateStr ? <>Target date: {targetDateStr} · no amount set</> : "No target set yet"}
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4">
        {hasMenu ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
              className="h-11 w-11 flex items-center justify-center rounded-full text-forest hover:bg-forest/10 transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute right-0 top-12 z-20 w-52 bg-paper rounded-[20px] shadow-[0_8px_28px_rgba(12,33,164,.16)] p-1.5 text-[14px]">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 min-h-11 rounded-[14px] text-left hover:bg-surface text-forest">
                    <Pencil className="h-4 w-4 text-ink-40" /> Edit goal
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 min-h-11 rounded-[14px] text-left hover:bg-surface text-forest">
                    <Pause className="h-4 w-4 text-ink-40" /> Pause goal
                  </button>
                  <div className="border-t border-hairline my-1" />
                  {confirmDelete ? (
                    <div className="px-3 py-2 space-y-2">
                      <p className="text-[13px] text-clay-ink font-medium">Remove "{goal.title}"?</p>
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); onDelete!(goal.id); setShowMenu(false); }} className="flex-1 h-9 bg-clay text-paper text-[13px] rounded-full font-semibold hover:opacity-90 transition-opacity">Yes</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="flex-1 h-9 border-[1.5px] border-forest text-forest text-[13px] rounded-full font-semibold hover:opacity-90 transition-opacity">No</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="w-full flex items-center gap-2 px-3 min-h-11 rounded-[14px] text-left hover:bg-clay-tint text-clay-ink">
                      <Trash2 className="h-4 w-4" /> Delete goal
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onTileActivate}
            className="h-11 w-11 flex items-center justify-center rounded-full"
            aria-label={expandable ? (expanded ? "Hide goal details" : "Show goal details") : "Edit goal"}
            aria-expanded={expandable ? expanded : undefined}
          >
            <span className="w-9 h-9 rounded-full bg-forest text-paper flex items-center justify-center">
              <ArrowUpRight className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-90")} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>

      {typeof goal.linkCount === "number" && goal.linkCount > 0 && (
        <p className="text-[13px] mt-3">
          {goal.linkCount} investment{goal.linkCount !== 1 ? "s" : ""} linked.
        </p>
      )}

      {/* Free-tier superset (GoalDetail look): what-if amounts, monthly breakdown,
          growth chip, advisor CTA and contribute/edit — only when the caller passes
          a real projection and the tile is expanded. */}
      {projection && (expanded || !expandable) && (
        <div className="mt-4 flex flex-col gap-3">
          <WhatIfBlock projection={projection} targetDateStr={targetDateStr} />
          <BreakdownRows projection={projection} currentMonthlyPace={currentMonthlyPace} />
          <GrowthChip amount={growthAmount} />
          {needsAttention && (
            <AdvisorCTA offTrack={goal.trackStatus === "off_track"} shortfall={projection.projectedShortfall} />
          )}
          {onContribute && (
            <button
              type="button"
              onClick={onContribute}
              className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />Add a contribution
            </button>
          )}
          {expandable && (
            <button
              type="button"
              onClick={onEdit}
              className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-full border-[1.5px] border-forest px-5 text-[14px] font-semibold text-forest transition-colors hover:bg-forest/5"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />Edit goal
            </button>
          )}
        </div>
      )}

      {onMarkComplete && (
        <div className="flex items-center gap-3 mt-4 pt-2 border-t border-forest/15">
          {confirmComplete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { onMarkComplete(goal.id); setConfirmComplete(false); }} className="h-9 px-4 rounded-full bg-forest text-paper text-[13.5px] font-semibold hover:opacity-90 transition-opacity">Yes, complete!</button>
              <button onClick={() => setConfirmComplete(false)} className="h-11 px-2 text-[13.5px] font-medium hover:underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmComplete(true)} className="flex items-center gap-1.5 min-h-11 text-[13.5px] font-semibold text-forest hover:underline underline-offset-2 transition-colors">
              <CheckCircle2 className="h-4 w-4" /> Mark complete
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
