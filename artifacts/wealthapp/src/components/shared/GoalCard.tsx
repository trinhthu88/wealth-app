import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import CurrencyField from "@/components/shared/CurrencyField";
import GoalStatusBadge from "@/components/client/goals/GoalStatusBadge";
import type { GoalStatus } from "@/hooks/useGoalProgress";
import type { ProjectionResult } from "@/lib/goalProjection";

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
import {
  MoreHorizontal, Pencil, Pause, Trash2, CheckCircle2, PlusCircle, TrendingUp,
  Palmtree, Home, GraduationCap, Rocket, Briefcase, Globe, Coins, Shield, Target,
  Umbrella, CreditCard, Plane, Car,
} from "lucide-react";

// Union of both tiers' goalType vocabularies — free tier and client tier grew
// separate onboarding flows with different goalType values, so both key sets
// are kept rather than picking one.
const GOAL_ICONS: Record<string, React.ElementType> = {
  retire: Palmtree, retirement: Umbrella,
  property: Home, home_purchase: Home,
  education: GraduationCap,
  fire: Rocket, fi: Rocket, financial_independence: Rocket,
  business: Briefcase,
  emigrate: Globe, travel: Plane, vehicle: Car,
  wealth: Coins, investment: TrendingUp,
  emergency: Shield, emergency_fund: Shield,
  debt: CreditCard, debt_payoff: CreditCard,
  other: Target,
};

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
  projection?: ProjectionResult;
  accountsBalance?: number;
  onContribute?: () => void;

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

function GrowthChip({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 w-fit bg-green-tint text-green">
      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span>+{fmtCompact(amount)}/month from savings interest &amp; investment returns</span>
    </div>
  );
}

function BreakdownCard({ projection, currentMonthlyPace }: { projection: ProjectionResult; currentMonthlyPace: number }) {
  const isOffTrack = !projection.onTrack;
  const rows = [
    { label: "Months remaining", value: `${projection.monthsRemaining} mo` },
    { label: "Required monthly", value: fmtCompact(projection.requiredMonthlySaving) },
    { label: "Your current pace", value: fmtCompact(currentMonthlyPace) },
    ...(isOffTrack && projection.monthlyShortfall > 0 ? [{ label: "Monthly shortfall", value: `-${fmtCompact(projection.monthlyShortfall)}`, red: true }] : []),
    { label: "Projected at target date", value: fmtCompact(projection.projectedAmount) },
  ];
  return (
    <div className="bg-surface rounded-xl p-4 border border-hairline space-y-2.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between text-xs">
          <span className="text-ink-40">{r.label}</span>
          <span className={cn("font-semibold", r.red ? "text-clay" : "text-forest")}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function AdvisorCTA({ offTrack, shortfall }: { offTrack: boolean; shortfall: number }) {
  return (
    <div className="bg-forest rounded-xl p-4">
      <p className="text-paper text-sm font-medium mb-1">
        {offTrack ? "This gap needs a professional strategy" : "Small optimisations could close this gap"}
      </p>
      {offTrack && shortfall > 0 ? (
        <p className="text-green-tint text-xs mb-3">
          A {fmtCompact(shortfall)} shortfall is solvable with the right investment plan. Let's talk.
        </p>
      ) : (
        <p className="text-green-tint text-xs mb-3">An advisor can identify small adjustments to get you fully on track.</p>
      )}
      <a href="/book" className="inline-flex items-center gap-1.5 bg-paper text-forest text-xs font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-paper/90">
        Book a free call
      </a>
    </div>
  );
}

const RING_R = 33;
const RING_CIRC = 2 * Math.PI * RING_R;

function ProgressRing({ pct, status }: { pct: number; status: GoalStatus }) {
  const ringColor = status === "off_track" ? "var(--clay)" : status === "at_risk" ? "var(--sun)" : "var(--green)";
  const offset = RING_CIRC - (Math.min(100, Math.max(0, pct)) / 100) * RING_CIRC;
  return (
    <svg viewBox="0 0 80 80" className="w-[76px] h-[76px] -rotate-90" aria-hidden="true">
      <circle cx="40" cy="40" r={RING_R} fill="none" stroke="var(--track)" strokeWidth="9" />
      <circle
        cx="40" cy="40" r={RING_R} fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={RING_CIRC} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
    </svg>
  );
}

export default function GoalCard({
  goal, onEdit, onDelete, onMarkComplete, projection, accountsBalance, onContribute, children, className,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const Icon = GOAL_ICONS[goal.goalType] ?? Target;
  const hasTarget = goal.targetAmountNum != null && goal.targetAmountNum > 0;
  const pct = goal.progressPct ?? 0;
  const targetDateStr = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  const growthAmount = projection?.monthlyGrowthFromReturns ?? 0;
  const currentMonthlyPace = (projection?.currentMonthlyCash ?? 0) + (projection?.monthlyGrowthFromReturns ?? 0);
  const hasMenu = !!onDelete;

  return (
    <div className={cn("bg-surface rounded-[28px] p-[20px_22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]", className)}>
      <div className="flex gap-[18px] items-start">
        <div className="relative w-[76px] h-[76px] flex-none">
          <ProgressRing pct={pct} status={goal.trackStatus} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="h-6 w-6 text-forest" aria-hidden="true" />
          </div>
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}
          aria-label={`Edit ${goal.title}`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display text-[18px] font-semibold text-forest leading-tight truncate">{goal.title}</div>
            <GoalStatusBadge status={goal.trackStatus} />
          </div>
          <div className="text-[13.5px] text-ink-40 mt-0.5 mb-[6px]">
            {hasTarget ? (
              <>Target: <CurrencyField amountUsd={goal.targetAmountNum!} compact />{targetDateStr && <> by {targetDateStr}</>}</>
            ) : targetDateStr ? (
              <>Target date: {targetDateStr} · no amount set</>
            ) : "No target set yet"}
          </div>
          <div className="text-[15px] font-semibold text-forest tabular-nums">
            <CurrencyField amountUsd={goal.computedCurrentAmount} />
            {hasTarget && (
              <span className="font-normal text-ink-30 ml-1">of <CurrencyField amountUsd={goal.targetAmountNum!} /></span>
            )}
          </div>
        </div>

        {hasMenu ? (
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
              className="h-8 w-8 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-black/5 transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute right-0 top-10 z-20 w-48 bg-surface border border-hairline rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,.08)] py-2 text-[14px]">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-black/5 text-forest">
                    <Pencil className="h-4 w-4 text-ink-40" /> Edit goal
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-black/5 text-ink-60">
                    <Pause className="h-4 w-4 text-ink-40" /> Pause goal
                  </button>
                  <div className="border-t border-hairline my-1.5" />
                  {confirmDelete ? (
                    <div className="px-4 py-2 space-y-2">
                      <p className="text-[13px] text-clay font-medium">Remove "{goal.title}"?</p>
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); onDelete!(goal.id); setShowMenu(false); }} className="flex-1 py-1.5 bg-clay text-white text-[13px] rounded-lg font-semibold hover:bg-red-600 transition-colors">Yes</button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="flex-1 py-1.5 border border-hairline text-ink-60 text-[13px] rounded-lg font-medium hover:bg-black/5 transition-colors">No</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-clay-tint text-clay">
                      <Trash2 className="h-4 w-4" /> Delete goal
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <button onClick={onEdit} className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-black/5 transition-colors" aria-label="Edit goal">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {typeof goal.linkCount === "number" && goal.linkCount > 0 && (
        <p className="text-[13px] text-ink-40 mt-3">
          {goal.linkCount} investment{goal.linkCount !== 1 ? "s" : ""} linked.
        </p>
      )}

      {/* Free-tier superset: projection breakdown, growth chip, advisor CTA — only
          renders when the caller passes a real projection (free tier does; client
          tier doesn't, since its funding comes from linked holdings, not a projection). */}
      {projection && (
        <div className="mt-3 space-y-3">
          <GrowthChip amount={growthAmount} />
          <BreakdownCard projection={projection} currentMonthlyPace={currentMonthlyPace} />
          {(goal.trackStatus === "off_track" || goal.trackStatus === "at_risk") && (
            <AdvisorCTA offTrack={goal.trackStatus === "off_track"} shortfall={projection.projectedShortfall} />
          )}
          {onContribute && (
            <Button size="sm" className="w-full gap-1.5" onClick={onContribute}>
              <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />Add contribution
            </Button>
          )}
        </div>
      )}

      {onMarkComplete && (
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-hairline">
          {confirmComplete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { onMarkComplete(goal.id); setConfirmComplete(false); }} className="text-[13.5px] text-green font-bold hover:underline">Yes, complete!</button>
              <button onClick={() => setConfirmComplete(false)} className="text-[13.5px] text-ink-40 hover:text-ink-60">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmComplete(true)} className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-60 hover:text-green transition-colors">
              <CheckCircle2 className="h-4 w-4" /> Mark complete
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
