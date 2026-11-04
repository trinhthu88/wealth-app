import { useState } from "react";
import { cn } from "@/lib/utils";
import Sol from "@/components/Sol";
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
  Umbrella, CreditCard, Plane, Car, ArrowUpRight,
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
    <div className="flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1.5 w-fit bg-paper/70 text-forest">
      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="tabular-nums">+{fmtCompact(amount)}/month from savings interest &amp; investment returns</span>
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
    <div className="bg-paper/70 rounded-2xl px-4 py-3 divide-y divide-forest/10">
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-forest/70">{r.label}</span>
          <span className={cn("font-semibold tabular-nums", r.red ? "text-clay-ink" : "text-forest")}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function AdvisorCTA({ offTrack, shortfall }: { offTrack: boolean; shortfall: number }) {
  return (
    <div className="bg-breeze rounded-2xl p-4 text-forest">
      <div className="flex items-start gap-3">
        <div className="shrink-0"><Sol size="sm" animate="breathe" /></div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-[1.35]">
            {offTrack ? "This gap needs a professional strategy" : "Small optimisations could close this gap"}
          </p>
          <p className="text-[13px] text-forest/75 leading-[1.45] mt-1 text-pretty">
            {offTrack && shortfall > 0
              ? <>A <span className="tabular-nums">{fmtCompact(shortfall)}</span> shortfall is solvable with the right investment plan. Let's talk.</>
              : "An advisor can identify small adjustments to get you fully on track."}
          </p>
          <a href="/book" className="mt-3 inline-flex items-center gap-1.5 h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90">
            Book a free call <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}

/** Tile colour follows pacing: Spring Field when on track or done, Sunset Pop
 * tint only when the goal needs attention, plain surface when there's no target. */
function tileClass(status: GoalStatus): string {
  switch (status) {
    case "at_risk":
    case "off_track": return "bg-sun-tint";
    case "on_track":
    case "completed": return "bg-field";
    default: return "bg-surface";
  }
}

export default function GoalCard({
  goal, onEdit, onDelete, onMarkComplete, projection, accountsBalance, onContribute, children, className,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const Icon = GOAL_ICONS[goal.goalType] ?? Target;
  const hasTarget = goal.targetAmountNum != null && goal.targetAmountNum > 0;
  const pct = Math.min(100, Math.max(0, goal.progressPct ?? 0));
  const targetDateStr = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  const needsAttention = goal.trackStatus === "off_track" || goal.trackStatus === "at_risk";

  const growthAmount = projection?.monthlyGrowthFromReturns ?? 0;
  const currentMonthlyPace = (projection?.currentMonthlyCash ?? 0) + (projection?.monthlyGrowthFromReturns ?? 0);
  const hasMenu = !!onDelete;

  return (
    <div className={cn("relative rounded-[28px] p-5 text-forest", tileClass(goal.trackStatus), className)}>
      <div
        className="cursor-pointer rounded-[20px] focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50"
        onClick={onEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}
        aria-label={`Edit ${goal.title}`}
      >
        <div className="flex items-center gap-3 pr-12 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-[14px] bg-paper/70 flex items-center justify-center">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold leading-tight truncate">{goal.title}</h3>
            <div className="text-[13px] text-forest/75 mt-0.5 truncate">
              {hasTarget ? (
                <>Target: <CurrencyField amountUsd={goal.targetAmountNum!} compact />{targetDateStr && <> by {targetDateStr}</>}</>
              ) : targetDateStr ? (
                <>Target date: {targetDateStr} · no amount set</>
              ) : "No target set yet"}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-2">
          {hasTarget ? (
            <span className="font-display tabular-nums text-[48px] leading-[0.9] tracking-[-0.04em]">{Math.round(pct)}%</span>
          ) : (
            <span className="font-display tabular-nums text-[32px] leading-none tracking-[-0.03em]">
              <CurrencyField amountUsd={goal.computedCurrentAmount} />
            </span>
          )}
          <GoalStatusBadge status={goal.trackStatus} />
        </div>

        {hasTarget && (
          <>
            <div className="mt-3 h-2 rounded-full bg-forest/15 overflow-hidden" aria-hidden="true">
              <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", needsAttention ? "bg-sun" : "bg-forest")} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 text-[14px] font-semibold tabular-nums">
              <CurrencyField amountUsd={goal.computedCurrentAmount} />
              <span className="font-normal text-forest/75 ml-1">of <CurrencyField amountUsd={goal.targetAmountNum!} /></span>
            </div>
          </>
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
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="flex-1 h-9 bg-surface text-forest text-[13px] rounded-full font-semibold hover:opacity-90 transition-opacity">No</button>
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
          <button onClick={onEdit} className="h-11 w-11 flex items-center justify-center rounded-full text-forest hover:bg-forest/10 transition-colors" aria-label="Edit goal">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {typeof goal.linkCount === "number" && goal.linkCount > 0 && (
        <p className="text-[13px] text-forest/75 mt-3">
          {goal.linkCount} investment{goal.linkCount !== 1 ? "s" : ""} linked.
        </p>
      )}

      {/* Free-tier superset: projection breakdown, growth chip, advisor CTA — only
          renders when the caller passes a real projection (free tier does; client
          tier doesn't, since its funding comes from linked holdings, not a projection). */}
      {projection && (
        <div className="mt-4 space-y-3">
          <GrowthChip amount={growthAmount} />
          <BreakdownCard projection={projection} currentMonthlyPace={currentMonthlyPace} />
          {needsAttention && (
            <AdvisorCTA offTrack={goal.trackStatus === "off_track"} shortfall={projection.projectedShortfall} />
          )}
          {onContribute && (
            <button
              type="button"
              onClick={onContribute}
              className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />Add contribution
            </button>
          )}
        </div>
      )}

      {onMarkComplete && (
        <div className="flex items-center gap-3 mt-4 pt-2 border-t border-forest/15">
          {confirmComplete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { onMarkComplete(goal.id); setConfirmComplete(false); }} className="h-9 px-4 rounded-full bg-forest text-paper text-[13.5px] font-semibold hover:opacity-90 transition-opacity">Yes, complete!</button>
              <button onClick={() => setConfirmComplete(false)} className="h-11 px-2 text-[13.5px] font-medium text-forest/70 hover:text-forest">Cancel</button>
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
