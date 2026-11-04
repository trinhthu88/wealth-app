import { MEMBERSHIP_CHECKPOINTS, TRIAL_ENDING_NOTICE_DAYS, type CheckpointCode, type Tier } from "@workspace/tier-policy";

/** Most specific first. The brief's order, then the Track B rung's codes. */
export const CHECKPOINT_PRIORITY: readonly CheckpointCode[] = [
  "C12_lapsed", "C11_trial_ending",
  "C2_goal_slot", "C5_investable", "C3_off_track", "C4_surplus", "C6_engaged", "C1_score_ready", "C7_direct",
  "C9_under_management", "C10_coast_point", "C8_plan_preview",
];

export const SURPLUS_SHARE = 0.15;
export const INVESTABLE_USD = 25_000;
export const DEVIATION_PP = -2;
export const ENGAGED_STREAK_WEEKS = 4;
export const ENGAGED_HIGH_SCORE = 70;
export const STUCK_LOW_SCORE = 50;
export const STUCK_AFTER_DAYS = 90;
export const REFIRE_COOLDOWN_DAYS = 30;
export const LEAD_REARM_DAYS = 90;
const DAY_MS = 86_400_000;

export interface ExistingCheckpoint {
  id: string;
  code: string;
  firedAt: Date;
  dismissedAt: Date | null;
  acceptedAt: Date | null;
}

export interface CheckpointGoal {
  id: string;
  title: string;
  goalType: string;
  status: string;
  hasTargetAndDate: boolean;
  /** computeGoalProgress status at each snapshot, newest first. */
  snapshotStatuses: string[];
  gapUsd: number | null;
  monthsRemaining: number | null;
}

export interface CheckpointHolding {
  id: string;
  label: string;
  valueUsd: number;
  /** Stated return minus benchmark, for ticker holdings with a stated return; otherwise null. */
  deviationPp: number | null;
}

export interface CheckpointBudgetMonth {
  month: string;
  netSurplus: number;
  totalIncome: number;
}

export interface CheckpointScore {
  overallScore: number | null;
  scoreDate: string;
  weakest: string | null;
}

export interface CheckpointContext {
  tier: Tier;
  onboardingComplete: boolean;
  signedUpAt: Date;
  hasInforcePlan: boolean;
  goals: CheckpointGoal[];
  holdings: CheckpointHolding[];
  budgetMonths: CheckpointBudgetMonth[];
  /** Newest first. */
  scores: CheckpointScore[];
  engagement: { streakWeeks: number } | null;
  existingCheckpoints: ExistingCheckpoint[];
  leadStatus: string | null;
  leadUpdatedAt: Date | null;
  membership: { status: string; trialEndsAt: Date | null; cancelAtPeriodEnd: boolean } | null;
  now: Date;
}

export interface CheckpointCandidate {
  code: CheckpointCode;
  snapshot: Record<string, unknown>;
}

function isOpen(c: ExistingCheckpoint): boolean {
  return !c.dismissedAt && !c.acceptedAt;
}

/** Whether the lead rules or this code's own history stop it firing now. */
export function isSuppressed(
  code: CheckpointCode,
  ctx: Pick<CheckpointContext, "existingCheckpoints" | "leadStatus" | "leadUpdatedAt" | "now">,
): boolean {
  const { leadStatus, leadUpdatedAt, now } = ctx;
  // C11 and C12 are about the member's own billing, so the lead rules don't apply to them.
  if (!MEMBERSHIP_CHECKPOINTS.includes(code)) {
    // While someone is already on the case, nothing new fires.
    if (leadStatus === "unassigned" || leadStatus === "active") return true;
    // The design re-arms checkpoints 90 days after a lead goes cold or churns.
    if ((leadStatus === "cold" || leadStatus === "churned") && leadUpdatedAt
      && now.getTime() - leadUpdatedAt.getTime() < LEAD_REARM_DAYS * DAY_MS) {
      return true;
    }
  }
  const history = ctx.existingCheckpoints.filter((c) => c.code === code);
  // The one already open is not fired again.
  if (history.some(isOpen)) return true;
  // C1 is an activation moment and happens once.
  if (code === "C1_score_ready" && history.length > 0) return true;
  // DECISION: an accepted checkpoint cools down like a dismissed one. The brief names only
  // dismissal, but a Track B client's accept makes no lead, so nothing else would stop
  // the same code firing again the next day.
  const lastResolved = Math.max(0, ...history.map((c) => (c.dismissedAt ?? c.acceptedAt)?.getTime() ?? 0));
  return lastResolved > 0 && now.getTime() - lastResolved < REFIRE_COOLDOWN_DAYS * DAY_MS;
}

function surplusCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  const recent = [...ctx.budgetMonths].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 3);
  const qualifying = recent.filter((m) => m.totalIncome > 0 && m.netSurplus >= SURPLUS_SHARE * m.totalIncome);
  if (qualifying.length < 2) return null;
  const latest = qualifying[0];
  return {
    code: "C4_surplus",
    snapshot: {
      monthlySurplus: latest.netSurplus,
      savingsRatePct: Math.round((latest.netSurplus / latest.totalIncome) * 1000) / 10,
      month: latest.month,
    },
  };
}

function investableCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  const portfolioValue = ctx.holdings.reduce((sum, h) => sum + h.valueUsd, 0);
  const worst = ctx.holdings
    .filter((h) => h.deviationPp !== null && h.deviationPp <= DEVIATION_PP)
    .sort((a, b) => a.deviationPp! - b.deviationPp!)[0];
  if (portfolioValue < INVESTABLE_USD && !worst) return null;
  return {
    code: "C5_investable",
    snapshot: {
      portfolioValue: Math.round(portfolioValue),
      holdingCount: ctx.holdings.length,
      ...(worst ? { holdingLabel: worst.label, deviationPp: worst.deviationPp } : {}),
    },
  };
}

function offTrackCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  // DECISION: "consecutive" is consecutive in the goal's snapshot series, as the design
  // words it. Snapshots are written only on activity, at most daily, so requiring adjacent
  // calendar days would miss anyone who does not open the app two days running.
  const goal = ctx.goals.find((g) => g.status === "active"
    && g.snapshotStatuses.length >= 2
    && g.snapshotStatuses[0] === "off_track"
    && g.snapshotStatuses[1] === "off_track");
  if (!goal) return null;
  return {
    code: "C3_off_track",
    snapshot: { goalId: goal.id, goalTitle: goal.title, gapUsd: goal.gapUsd, monthsRemaining: goal.monthsRemaining },
  };
}

function scoreReadyCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  if (!ctx.onboardingComplete || ctx.scores.length === 0) return null;
  return { code: "C1_score_ready", snapshot: { score: ctx.scores[0].overallScore, weakest: ctx.scores[0].weakest } };
}

function engagedCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  const score = ctx.scores[0]?.overallScore;
  if (score === null || score === undefined) return null;
  const streakWeeks = ctx.engagement?.streakWeeks ?? 0;
  if (streakWeeks >= ENGAGED_STREAK_WEEKS && score >= ENGAGED_HIGH_SCORE) {
    return { code: "C6_engaged", snapshot: { variant: "engaged_high", streakWeeks, score } };
  }
  const daysActive = (ctx.now.getTime() - ctx.signedUpAt.getTime()) / DAY_MS;
  if (daysActive >= STUCK_AFTER_DAYS && score < STUCK_LOW_SCORE) {
    return { code: "C6_engaged", snapshot: { variant: "engaged_low", daysActive: Math.floor(daysActive), score } };
  }
  return null;
}

function planPreviewCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  if (ctx.hasInforcePlan) return null;
  const latest = [...ctx.budgetMonths].sort((a, b) => b.month.localeCompare(a.month))[0];
  if (!latest || latest.netSurplus <= 0) return null;
  return { code: "C8_plan_preview", snapshot: { monthlySurplus: latest.netSurplus, month: latest.month } };
}

function underManagementCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  const worst = ctx.holdings
    .filter((h) => h.deviationPp !== null && h.deviationPp <= DEVIATION_PP)
    .sort((a, b) => a.deviationPp! - b.deviationPp!)[0];
  if (!worst) return null;
  return { code: "C9_under_management", snapshot: { holdingId: worst.id, holdingLabel: worst.label, deviationPp: worst.deviationPp } };
}

function coastPointCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  const goal = ctx.goals.find((g) => (g.goalType === "retire" || g.goalType === "retirement") && g.hasTargetAndDate);
  return goal ? { code: "C10_coast_point", snapshot: { goalId: goal.id, goalTitle: goal.title } } : null;
}

/**
 * DECISION: C11 fires for every trialing member who hasn't already chosen to cancel. The addendum
 * also says "with no card on file", but its final decision makes a card required, so that
 * condition would mean C11 never fires. Reminding people before the first charge is what's left.
 */
function trialEndingCandidate(ctx: CheckpointContext): CheckpointCandidate | null {
  const m = ctx.membership;
  if (m?.status !== "trialing" || !m.trialEndsAt || m.cancelAtPeriodEnd) return null;
  const msLeft = m.trialEndsAt.getTime() - ctx.now.getTime();
  if (msLeft <= 0 || msLeft > TRIAL_ENDING_NOTICE_DAYS * DAY_MS) return null;
  return { code: "C11_trial_ending", snapshot: { trialEndsAt: m.trialEndsAt.toISOString() } };
}

/**
 * Pure: which checkpoints this user's data qualifies for right now, after the suppression
 * rules. C2 and the sixth-holding path of C5 are raised by requireAllowance, not here.
 *
 * DECISION: the brief's trigger table covers C1 to C6 and gives none for C8 to C10, but it
 * wires components to those codes, which would then never appear. Their triggers come from
 * the design's catalogue. Tiers follow the design: C1, C2, C5, C6 and C10 are free only;
 * C3, C4 and C8 reach Track B too, because their components are Track B CTAs today; C9 is
 * Track B only. Track A is the top rung, so only the trial reminder fires for it. C12 is raised
 * by the membership store at the moment of the lapse, so it fires once and not on every evaluation.
 */
export function evaluate(ctx: CheckpointContext): CheckpointCandidate[] {
  const trialEnding = trialEndingCandidate(ctx);
  const found: (CheckpointCandidate | null)[] = ctx.tier === "track_a"
    ? [trialEnding]
    : ctx.tier === "free"
    ? [
        surplusCandidate(ctx), investableCandidate(ctx), offTrackCandidate(ctx), scoreReadyCandidate(ctx),
        engagedCandidate(ctx), planPreviewCandidate(ctx), coastPointCandidate(ctx),
      ]
    : [trialEnding, surplusCandidate(ctx), offTrackCandidate(ctx), planPreviewCandidate(ctx), underManagementCandidate(ctx)];
  return found.filter((c): c is CheckpointCandidate => !!c && !isSuppressed(c.code, ctx));
}

export interface CheckpointDecision {
  fire: CheckpointCandidate | null;
  /** An open checkpoint the winner replaces, so one stays open. */
  supersede: ExistingCheckpoint | null;
}

const rank = (code: string) => {
  const i = CHECKPOINT_PRIORITY.indexOf(code as CheckpointCode);
  return i === -1 ? CHECKPOINT_PRIORITY.length : i;
};

/**
 * Pure: picks the winner, keeping at most one checkpoint open.
 *
 * DECISION: a higher-priority candidate supersedes a lower-priority open one rather than
 * waiting. C1 sits on the dashboard with no ask, so if it stayed open until dismissed, a
 * user who ignored it would never see C2 at the moment they hit the goal cap.
 */
export function decide(candidates: CheckpointCandidate[], existing: ExistingCheckpoint[]): CheckpointDecision {
  const winner = [...candidates].sort((a, b) => rank(a.code) - rank(b.code))[0] ?? null;
  if (!winner) return { fire: null, supersede: null };
  const open = existing.find(isOpen) ?? null;
  if (!open) return { fire: winner, supersede: null };
  return rank(winner.code) < rank(open.code) ? { fire: winner, supersede: open } : { fire: null, supersede: null };
}
