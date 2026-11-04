import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Target, ChevronDown, ChevronRight, Link as LinkIcon, TrendingUp, CheckCircle2, Palmtree, Home, GraduationCap, Rocket, Briefcase, Globe, Coins, Shield, MoreHorizontal, Pencil, Pause, Trash2, Umbrella, CreditCard, Plane, Car, ChartLine, List } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import SolNarration from "@/components/client/SolNarration";
import GoalsSummaryBar from "@/components/client/goals/GoalsSummaryBar";
import AddGoalSheet from "@/components/client/goals/AddGoalSheet";
import { gateMessage } from "@workspace/tier-policy";
import { useCapAttempt, useCapability } from "@/hooks/useEntitlements";
import LockedGoalSlotCard from "@/components/LockedGoalSlotCard";
import { CapNotice } from "@/components/client/Gated";
import EditGoalSheet from "@/components/client/goals/EditGoalSheet";
import GoalHoldingLinks from "@/components/client/goals/GoalHoldingLinks";
import GoalScenarioCTA from "@/components/client/goals/GoalScenarioCTA";
import SolCard from "@/components/client/goals/SolCard";
import { generateSolCopy, isProgressMovementNoteworthy, type SolMessage, type SolObservation } from "@/lib/sol";
import { detectUnallocatedSources, pickNextSuggestion, type UnallocatedSource } from "@/lib/solObservations";
import { useSolProgressMovement } from "@/hooks/useSolProgressMovement";
import { useEnsureOffTrackTask } from "@/hooks/useEnsureOffTrackTask";
import { useClientTrack } from "@/hooks/useClientTrack";
import { useCreateLeadFromInterest } from "@/hooks/useCreateLeadFromInterest";
import CurrencyField from "@/components/shared/CurrencyField";
import GoalStatusBadge from "@/components/client/goals/GoalStatusBadge";
import { cn } from "@/lib/utils";
import { useGoals, type EnrichedGoal } from "@/hooks/useGoals";
import { usePlan } from "@/hooks/usePlan";

// Same goalType → icon vocabulary as the shared GoalCard (both tiers' keys).
const CARD_GOAL_ICONS: Record<string, React.ElementType> = {
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

/**
 * Client-tier goal card: the same content and actions as the shared GoalCard
 * shell (title, status, target, saved amount, "..." edit / pause / delete menu,
 * tap-to-edit), laid out as a full-strength palette card with the progress
 * percentage as the card's single display number. Sunset Pop is reserved for
 * goals that need attention; the rest alternate Spring Field / Blue Breeze.
 */
function GoalCardShell({ goal, index, onEdit, onDelete, children, className }: {
  goal: EnrichedGoal;
  index: number;
  onEdit: () => void;
  onDelete: (id: string) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const Icon = CARD_GOAL_ICONS[goal.goalType] ?? Target;
  const hasTarget = goal.targetAmountNum != null && goal.targetAmountNum > 0;
  const pct = Math.min(100, Math.max(0, goal.progressPct ?? 0));
  const targetDateStr = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  const needsAttention = goal.trackStatus === "off_track" || goal.trackStatus === "at_risk";
  const cardBg = needsAttention ? "bg-sun" : index % 2 === 0 ? "bg-field" : "bg-breeze";

  return (
    <div className={cn("relative rounded-[28px] p-5 text-forest", cardBg, className)}>
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
            <div className="text-[17px] font-semibold leading-tight truncate">{goal.title}</div>
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
          {/* On a Sunset card the attention pill flips to Cobalt so it stays visible. */}
          <span className={cn(needsAttention && "[&>span]:bg-forest [&>span]:text-paper")}>
            <GoalStatusBadge status={goal.trackStatus} />
          </span>
        </div>

        {hasTarget && (
          <>
            <div className="mt-3 h-2 rounded-full bg-forest/15 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 text-[14px] font-semibold tabular-nums">
              <CurrencyField amountUsd={goal.computedCurrentAmount} />
              <span className="font-normal text-forest/75 ml-1">of <CurrencyField amountUsd={goal.targetAmountNum!} /></span>
            </div>
          </>
        )}
      </div>

      <div className="absolute top-4 right-4">
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
                  <p className="text-[13px] text-red-600 font-medium">Remove "{goal.title}"?</p>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(goal.id); setShowMenu(false); }} className="flex-1 h-9 bg-red-600 text-white text-[13px] rounded-full font-semibold hover:bg-red-700 transition-colors">Yes</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="flex-1 h-9 border-[1.5px] border-forest text-forest text-[13px] rounded-full font-semibold hover:bg-forest/5 transition-colors">No</button>
                  </div>
                </div>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="w-full flex items-center gap-2 px-3 min-h-11 rounded-[14px] text-left hover:bg-red-50 text-red-600">
                  <Trash2 className="h-4 w-4" /> Delete goal
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {children}
    </div>
  );
}

function GoalCardInline({ goal, index, plans, holdings, allLinks, allGoals, solSuggestion, onDismissSuggestion, setEditTarget, markComplete, deleteGoal, addHoldingLink, removeHoldingLink, openLinksOnMount }: any) {
  const [showLinks, setShowLinks] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [autoLinkTarget, setAutoLinkTarget] = useState<{ sourceType: string; sourceId: string } | null>(null);

  useEffect(() => {
    if (openLinksOnMount) setShowLinks(true);
  }, [openLinksOnMount]);

  const isActive = goal.status !== "completed" && goal.status !== "cancelled";
  const { data: progressMovement } = useSolProgressMovement(goal.id, isActive);
  const progressNote: SolMessage | null = progressMovement?.hasPrior && isProgressMovementNoteworthy(progressMovement)
    ? generateSolCopy({
        type: "progress_movement", goalTitle: goal.title, deltaTotal: progressMovement.deltaTotal,
        marketDelta: progressMovement.marketDelta, contributionDelta: progressMovement.contributionDelta,
        reallocationDelta: progressMovement.reallocationDelta,
        // Non-null by the API's own contract whenever hasPrior is true (see
        // ProgressMovement / getProgressMovement in goalProgressSnapshot.ts).
        fromDate: progressMovement.fromDate as string, toDate: progressMovement.toDate as string,
      })
    : null;

  const [, setLocation] = useLocation();
  const { isTrackA } = useClientTrack();
  const createLead = useCreateLeadFromInterest();
  const isOffTrack = isActive && goal.trackStatus === "off_track";
  const [offTrackDismissed, setOffTrackDismissed] = useState(() => localStorage.getItem(`sol_offtrack_dismissed_${goal.id}`) === "1");
  const showOffTrackCard = isOffTrack && !offTrackDismissed;

  // Passive-on-view, fires once per mount for any active goal (not just
  // off-track ones) — the server re-derives status itself and needs the
  // on-track case too, so it can close out a stale open task from a prior
  // episode instead of leaving it to block a future one (see
  // api-server/src/lib/offTrackTasks.ts). This call never decides anything
  // client-side, it just tells the advisor side to re-check.
  const ensureOffTrackTask = useEnsureOffTrackTask();
  const offTrackTaskFired = useRef(false);
  useEffect(() => {
    if (isActive && !offTrackTaskFired.current) {
      offTrackTaskFired.current = true;
      ensureOffTrackTask.mutate(goal.id);
    }
  }, [isActive, goal.id]);

  const isBehind = goal.trackStatus === "at_risk" || goal.trackStatus === "off_track";

  return (
    <GoalCardShell
      goal={goal}
      index={index}
      onEdit={() => setEditTarget(goal)}
      onDelete={deleteGoal}
      className="mb-[14px]"
    >
      {progressNote && (
        <p className="text-[13px] text-forest/75 mt-3 leading-snug">{progressNote.body}</p>
      )}

      {/* Note blocks */}
      {goal.notes ? (
        <div className="mt-4 bg-paper/70 rounded-[16px] p-[12px_14px] text-[13.5px] text-forest leading-[1.45] flex gap-[9px]">
          <span className="font-semibold shrink-0">Sol</span>
          <span>{goal.notes}</span>
        </div>
      ) : isBehind ? (
        <div className="mt-4 bg-paper/70 rounded-[16px] p-[12px_14px] text-[13.5px] text-forest leading-[1.45]">
          This goal is behind schedule. Run a scenario to test a higher monthly contribution.
        </div>
      ) : (
        <div className="mt-4 bg-paper/70 rounded-[16px] p-[12px_14px] text-[13.5px] text-forest leading-[1.45] flex gap-[9px]">
          <span className="font-semibold shrink-0">Sol</span>
          <span>On track. Keep it up!</span>
        </div>
      )}

      {/* Sol: unallocated / newly-added holding suggestion. The parent already
          filters out anything dismissed before ranking, so a non-null prop here
          means it's current — dismissing just reports it upward, which re-ranks
          and lets the next-best candidate take this slot. */}
      {solSuggestion && (
        <SolCard
          className="mt-3 bg-paper/70"
          message={solSuggestion.message}
          onAccept={() => {
            setAutoLinkTarget({ sourceType: solSuggestion.sourceType, sourceId: solSuggestion.sourceId });
            setShowLinks(true);
          }}
          onDismiss={() => onDismissSuggestion(solSuggestion.sourceType, solSuggestion.sourceId)}
        />
      )}

      {/* Linked holdings text */}
      {goal.links.length > 0 && (
        <p className="text-[13px] text-forest/75 mt-3 px-1">
          {goal.links.length} investment{goal.links.length !== 1 ? 's' : ''} linked.
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-4 pt-2 border-t border-forest/15">
        <button
          onClick={(e) => { e.stopPropagation(); setShowLinks(v => !v); }}
          data-testid={`button-goal-links-${goal.id}`}
          className="flex items-center gap-1.5 min-h-11 text-[13.5px] font-semibold text-forest hover:text-forest-700 hover:underline underline-offset-2 transition-colors cursor-pointer"
        >
          <LinkIcon className="h-4 w-4" />
          {goal.links.length > 0 ? "Manage links" : "Link a holding"}
        </button>
        <span className="text-forest/25 hidden sm:inline" aria-hidden="true">|</span>
        <Link
          href={`/client/goals/what-if?goalId=${goal.id}&type=retire_earlier`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 min-h-11 text-[13.5px] font-semibold text-forest hover:text-forest-700 hover:underline underline-offset-2 transition-colors cursor-pointer"
        >
          <TrendingUp className="h-4 w-4" />
          Run scenario
        </Link>
        <span className="text-forest/25 hidden sm:inline" aria-hidden="true">|</span>
        {confirmComplete ? (
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); markComplete(goal.id); setConfirmComplete(false); }} className="h-9 px-4 rounded-full bg-forest text-paper text-[13.5px] font-semibold cursor-pointer hover:bg-forest-700 transition-colors">Yes, complete!</button>
            <button onClick={(e) => { e.stopPropagation(); setConfirmComplete(false); }} className="h-11 px-2 text-[13.5px] font-medium text-forest/70 cursor-pointer hover:text-forest">Cancel</button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmComplete(true); }}
            className="flex items-center gap-1.5 min-h-11 text-[13.5px] font-semibold text-forest hover:text-forest-700 hover:underline underline-offset-2 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark complete
          </button>
        )}
      </div>

      {/* Sol: off-track nudge into the scenario flow. Replaces (not stacks with)
          GoalScenarioCTA for off_track specifically — that component still owns
          at_risk. Track A gets the scenario tool; Track B keeps the same
          "message your advisor" path GoalScenarioCTA used to offer here, just
          folded into one card instead of two competing banners. */}
      {showOffTrackCard && (
        <SolCard
          className="mt-4 bg-paper/70"
          message={{
            ...generateSolCopy({ type: "off_track", goalTitle: goal.title }),
            actionLabel: isTrackA ? "Run a scenario" : "See how an advisor can help",
          }}
          onAccept={() => {
            createLead.mutate("C3_off_track"); // same CTA slot GoalScenarioCTA owns for at_risk
            setLocation(isTrackA ? `/client/goals/what-if?goalId=${goal.id}&type=retire_earlier` : "/client/advisor/messages");
          }}
          onDismiss={() => { localStorage.setItem(`sol_offtrack_dismissed_${goal.id}`, "1"); setOffTrackDismissed(true); }}
        />
      )}

      {goal.trackStatus !== "off_track" && (
        <div className="mt-4">
          <GoalScenarioCTA goalId={goal.id} goalTitle={goal.title} status={goal.trackStatus} />
        </div>
      )}

      {showLinks && (
        <div className="mt-4">
          <GoalHoldingLinks
            key={autoLinkTarget ? `${autoLinkTarget.sourceType}:${autoLinkTarget.sourceId}` : "default"}
            goalId={goal.id}
            links={goal.links}
            allLinks={allLinks}
            goals={allGoals}
            plans={plans}
            holdings={holdings}
            initialLinkTarget={autoLinkTarget}
            onAddLink={(p) => addHoldingLink(p).then(() => {})}
            onRemoveLink={(id) => removeHoldingLink(id).then(() => {})}
            onClose={() => { setShowLinks(false); setAutoLinkTarget(null); }}
          />
        </div>
      )}
    </GoalCardShell>
  );
}

export default function ClientGoals() {
  const {
    activeGoals, completedGoals, allGoals, goalsOnTrack, goalsAtRisk, goalsOffTrack,
    loading, plans, holdings, allLinks,
    addGoal, updateGoal, deleteGoal, markComplete, reopenGoal,
    addHoldingLink, removeHoldingLink,
  } = useGoals();

  const { advisorName } = usePlan();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<EnrichedGoal | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const requestedLinkGoalId = new URLSearchParams(window.location.search).get("openLink");

  // Handle ?newGoal=true URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("newGoal") === "true") setShowAdd(true);
  }, []);
  const goalCap = useCapability("goals");
  const capAttempt = useCapAttempt("/goals");
  const goalCapMessage = goalCap.atCap ? gateMessage("goals", goalCap.limits?.goals ?? null) : null;

  const totalActive = activeGoals.length;
  const totalValue = activeGoals.reduce((sum, g) => sum + g.computedCurrentAmount, 0);

  // Sol: surface at most one unallocated/newly-added holding suggestion at a
  // time, on the top-priority active goal (activeGoals is already sorted
  // off-track-first). `dismissedSuggestionKeys` is session-only state layered
  // on top of the localStorage record so dismissing one immediately re-ranks
  // and surfaces the next candidate, instead of the same one blocking the
  // rest forever (see pickNextSuggestion in solObservations.ts).
  const [dismissedSuggestionKeys, setDismissedSuggestionKeys] = useState<Set<string>>(() => new Set());
  function isSuggestionDismissed(sourceType: string, sourceId: string): boolean {
    const key = `${sourceType}:${sourceId}`;
    return dismissedSuggestionKeys.has(key) || localStorage.getItem(`sol_suggestion_dismissed_${key}`) === "1";
  }
  function dismissSuggestion(sourceType: string, sourceId: string): void {
    const key = `${sourceType}:${sourceId}`;
    localStorage.setItem(`sol_suggestion_dismissed_${key}`, "1");
    setDismissedSuggestionKeys(prev => new Set(prev).add(key));
  }

  const targetGoal = activeGoals[0];
  const topUnallocatedSource: UnallocatedSource | null = targetGoal
    ? pickNextSuggestion(
        detectUnallocatedSources({ goals: activeGoals, holdings, plans, allLinks }),
        isSuggestionDismissed,
      )
    : null;
  const solSuggestion = topUnallocatedSource && targetGoal
    ? {
        sourceType: topUnallocatedSource.sourceType,
        sourceId: topUnallocatedSource.sourceId,
        message: generateSolCopy({ ...topUnallocatedSource.observation, goalNames: [targetGoal.title] } as SolObservation),
      }
    : null;

  if (loading) {
    return (
      <ClientAppShell>
        <div className="space-y-[14px]">
          {[1, 2].map(i => (
            <div key={i} className="h-36 bg-surface animate-pulse rounded-[28px]" />
          ))}
        </div>
      </ClientAppShell>
    );
  }

  return (
    <ClientAppShell>
      <div className="space-y-[14px]">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3 pt-1 mb-[4px]">
          <h1 className="font-display text-[34px] leading-[1.05] text-forest">Goals</h1>
          <button
            onClick={() => (goalCap.atCap ? capAttempt.mutate() : setShowAdd(true))}
            aria-disabled={goalCap.atCap}
            title={goalCapMessage ?? undefined}
            className="w-11 h-11 shrink-0 rounded-full bg-forest text-paper flex items-center justify-center cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:opacity-40 hover:bg-forest-700 transition-colors"
            aria-label="Add goal"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {goalCapMessage && <CapNotice message={goalCapMessage} />}
        <LockedGoalSlotCard />

        <>
            {targetGoal && targetGoal.progressPct != null && (
              <SolNarration
                line={`${targetGoal.title} sits at ${Math.round(targetGoal.progressPct)}% of $${Math.round(targetGoal.targetAmountNum ?? 0).toLocaleString()}${targetGoal.monthsRemaining ? `, with ${targetGoal.monthsRemaining} months to cover the rest` : ""}.`}
                detail="Early progress on a long-dated goal is mostly what you pay in — two decades of compounding is what closes most of a gap like this. Consistent contributions matter more here than any single month's return."
                advisorFirstName={advisorName?.split(" ")[0] ?? null}
              />
            )}
            <div className="text-[14px] text-ink-40 tabular-nums mb-[8px]">
              {totalActive} live · <CurrencyField amountUsd={totalValue} compact showSign={false} /> in play
            </div>

            {/* Summary bar */}
            {(totalActive > 0 || completedGoals.length > 0) && (
              <div className="mb-[20px]">
                <GoalsSummaryBar
                  totalActive={totalActive}
                  onTrack={goalsOnTrack}
                  atRisk={goalsAtRisk}
                  offTrack={goalsOffTrack}
                />
              </div>
            )}

            {/* Empty state */}
            {totalActive === 0 && completedGoals.length === 0 && (
              <div className="bg-surface rounded-[28px] py-14 px-6 text-center">
                <div className="w-11 h-11 rounded-[14px] bg-field text-forest flex items-center justify-center mx-auto mb-4">
                  <Target className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-[16px] font-semibold text-forest mb-2">No goals yet</h2>
                <p className="text-[14px] text-ink-40 mb-5 max-w-xs mx-auto">
                  Set your first financial goal to start tracking progress.
                </p>
                <button
                  onClick={() => setShowAdd(true)}
                  className="h-11 px-5 rounded-full bg-forest text-paper text-[14px] font-semibold hover:bg-forest-700 transition-colors cursor-pointer"
                >
                  Set your first goal
                </button>
              </div>
            )}

            {/* Active goal cards */}
            {activeGoals.map((goal, i) => (
              <GoalCardInline
                key={goal.id}
                goal={goal}
                index={i}
                plans={plans}
                holdings={holdings}
                allLinks={allLinks}
                allGoals={allGoals}
                solSuggestion={goal.id === targetGoal?.id ? solSuggestion : null}
                onDismissSuggestion={dismissSuggestion}
                setEditTarget={setEditTarget}
                deleteGoal={(id: string) => void deleteGoal(id)}
                markComplete={(id: string) => void markComplete(id)}
                addHoldingLink={addHoldingLink}
                removeHoldingLink={removeHoldingLink}
                openLinksOnMount={requestedLinkGoalId === goal.id}
              />
            ))}

            {/* Completed goals section */}
            {completedGoals.length > 0 && (
              <div className="space-y-[14px] mt-6">
                <button
                  onClick={() => setCompletedOpen(v => !v)}
                  className="flex items-center gap-2 min-h-11 px-1 text-[16px] font-semibold text-forest hover:text-forest-700 transition-colors cursor-pointer"
                >
                  {completedOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  {completedGoals.length} completed {completedGoals.length === 1 ? "goal" : "goals"}
                </button>

                {completedOpen && (
                  <div className="bg-surface rounded-[24px] p-1">
                    {completedGoals.map(goal => {
                      const GOAL_ICONS: Record<string, React.ElementType> = {
                        retire: Palmtree, property: Home, education: GraduationCap, fire: Rocket,
                        business: Briefcase, emigrate: Globe, wealth: Coins, emergency: Shield, other: Target,
                      };
                      const Icon = GOAL_ICONS[goal.goalType] || Target;
                      return (
                        <div
                          key={goal.id}
                          className="p-3 flex items-center justify-between border-b border-hairline last:border-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 flex-shrink-0 rounded-[14px] bg-field text-forest flex items-center justify-center">
                              <Icon className="w-5 h-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold text-forest truncate">{goal.title}</p>
                              <p className="text-[13px] text-ink-40 tabular-nums">
                                {goal.targetAmountNum
                                  ? `$${Math.round(goal.targetAmountNum).toLocaleString()} reached`
                                  : "Completed"}
                                {(goal as any).completedAt
                                  ? ` · ${new Date((goal as any).completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => reopenGoal(goal.id)}
                            className="h-11 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[13px] font-semibold hover:bg-forest/5 transition-colors ml-3 shrink-0 cursor-pointer"
                          >
                            Reopen
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Plan ahead */}
            <section aria-label="Plan ahead" className="space-y-3 pt-1.5">
              <h2 className="px-1 text-[16px] font-semibold text-forest">Plan ahead</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/client/goals/what-if"
                  className="bg-breeze text-forest rounded-[24px] p-4 min-h-[140px] flex flex-col justify-between gap-5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
                >
                  <ChartLine className="h-8 w-8" strokeWidth={1.8} aria-hidden="true" />
                  <span className="flex flex-col gap-1">
                    <span className="text-[16px] font-semibold">What-if</span>
                    <span className="text-[13px]">Try changes first</span>
                  </span>
                </Link>
                <Link
                  href="/client/goals/my-plan"
                  className="bg-surface text-forest rounded-[24px] p-4 min-h-[140px] flex flex-col justify-between gap-5 transition-colors hover:bg-breeze/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
                >
                  <List className="h-8 w-8" strokeWidth={1.8} aria-hidden="true" />
                  <span className="flex flex-col gap-1">
                    <span className="text-[16px] font-semibold">My plan</span>
                    <span className="text-[13px] text-ink-40">Milestones with your advisor</span>
                  </span>
                </Link>
              </div>
            </section>
        </>
      </div>

      <AddGoalSheet
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={(data) => addGoal(data).then(() => {})}
      />

      <EditGoalSheet
        goal={editTarget}
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        onSave={(id, data) => updateGoal(id, data).then(() => {})}
        onDelete={(id) => void deleteGoal(id)}
      />
    </ClientAppShell>
  );
}
