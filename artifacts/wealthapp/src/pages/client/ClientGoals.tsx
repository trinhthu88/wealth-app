import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Target, ChevronDown, ChevronRight, Link as LinkIcon, TrendingUp, CheckCircle2, Palmtree, Home, GraduationCap, Rocket, Briefcase, Globe, Coins, Shield } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import GoalsSummaryBar from "@/components/client/goals/GoalsSummaryBar";
import AddGoalSheet from "@/components/client/goals/AddGoalSheet";
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
import PlanHeader from "@/components/client/plan/PlanHeader";
import ReviewCountdown from "@/components/client/plan/ReviewCountdown";
import PlanProgressRing from "@/components/client/plan/PlanProgressRing";
import PlanTimeline from "@/components/client/plan/PlanTimeline";
import RequestReviewSheet from "@/components/client/plan/RequestReviewSheet";
import CurrencyField from "@/components/shared/CurrencyField";
import GoalCard from "@/components/shared/GoalCard";
import { useGoals, type EnrichedGoal } from "@/hooks/useGoals";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

const GOALS_TABS = [
  { id: "goals", label: "Goals" },
  { id: "plan", label: "Your plan" },
] as const;

function GoalsTabs({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  return (
    <div className="flex gap-1 bg-surface border border-hairline rounded-full p-1 w-fit mb-[20px]" role="tablist" aria-label="Goals and plan">
      {GOALS_TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-5 py-2 rounded-full text-[14px] font-semibold transition-all cursor-pointer",
            activeTab === tab.id
              ? "bg-forest text-paper shadow-sm"
              : "text-ink-60 hover:text-forest"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PlanTab() {
  const {
    milestones,
    completedCount, inProgressCount, upcomingCount, totalCount, completionPct,
    nextMilestone, daysUntilReview, isReviewOverdue,
    advisorName, advisorId, nextReviewDate,
    loading,
  } = usePlan();

  const [showReviewSheet, setShowReviewSheet] = useState(false);

  if (loading) {
    return (
      <div className="space-y-[14px]">
        <div className="h-24 bg-surface animate-pulse rounded-[28px]" />
        <div className="h-40 bg-surface animate-pulse rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="space-y-[14px]">
      <div className="bg-surface rounded-[28px] p-[20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
        <PlanHeader advisorName={advisorName} />
      </div>

      <div className="bg-surface rounded-[28px] p-[20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
        <ReviewCountdown
          nextReviewDate={nextReviewDate}
          daysUntilReview={daysUntilReview}
          isReviewOverdue={isReviewOverdue}
          onRequestReview={() => setShowReviewSheet(true)}
        />
      </div>

      {totalCount > 0 && (
        <div className="bg-surface rounded-[28px] p-[20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <PlanProgressRing
            completedCount={completedCount}
            inProgressCount={inProgressCount}
            upcomingCount={upcomingCount}
            totalCount={totalCount}
            completionPct={completionPct}
          />
        </div>
      )}

      {milestones.length > 0 ? (
        <div className="bg-surface rounded-[28px] p-[20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <h2 className="text-[16px] font-semibold text-forest mb-4">Milestones</h2>
          <PlanTimeline
            milestones={milestones}
            nextMilestoneId={nextMilestone?.id ?? null}
          />
        </div>
      ) : (
        <div className="bg-surface shadow-[0_2px_14px_rgba(20,52,42,.06)] rounded-[28px] py-10 text-center">
          <p className="text-[14px] text-ink-40">No milestones have been added to your plan yet.</p>
        </div>
      )}

      <RequestReviewSheet
        isOpen={showReviewSheet}
        onClose={() => setShowReviewSheet(false)}
        advisorId={advisorId}
        advisorName={advisorName}
        completionPct={completionPct}
        nextMilestoneTitle={nextMilestone?.title ?? null}
      />
    </div>
  );
}

function GoalCardInline({ goal, plans, holdings, allLinks, allGoals, solSuggestion, onDismissSuggestion, setEditTarget, markComplete, deleteGoal, addHoldingLink, removeHoldingLink }: any) {
  const [showLinks, setShowLinks] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [autoLinkTarget, setAutoLinkTarget] = useState<{ sourceType: string; sourceId: string } | null>(null);

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
    <GoalCard
      goal={goal}
      onEdit={() => setEditTarget(goal)}
      onDelete={deleteGoal}
      className="mb-[14px]"
    >
      {progressNote && (
        <p className="text-[12px] text-ink-30 -mt-2 mb-3 leading-snug">{progressNote.body}</p>
      )}

      {/* Note blocks */}
      {goal.notes ? (
        <div className="mt-[16px] bg-[#F5FAF7] rounded-[16px] p-[12px_14px] text-[13.5px] text-[#3F6B58] leading-[1.45] flex gap-[9px]">
          <span className="text-green font-bold shrink-0">Sol</span> 
          <span>{goal.notes}</span>
        </div>
      ) : isBehind ? (
        <div className="mt-[16px] bg-clay-tint rounded-[16px] p-[12px_14px] text-[13.5px] text-clay-ink leading-[1.45]">
          This goal is behind schedule. Run a scenario to test a higher monthly contribution.
        </div>
      ) : (
        <div className="mt-[16px] bg-[#F5FAF7] rounded-[16px] p-[12px_14px] text-[13.5px] text-[#3F6B58] leading-[1.45] flex gap-[9px]">
          <span className="text-green font-bold shrink-0">Sol</span> 
          <span>On track. Keep it up!</span>
        </div>
      )}

      {/* Sol: unallocated / newly-added holding suggestion. The parent already
          filters out anything dismissed before ranking, so a non-null prop here
          means it's current — dismissing just reports it upward, which re-ranks
          and lets the next-best candidate take this slot. */}
      {solSuggestion && (
        <SolCard
          className="mt-[12px]"
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
        <p className="text-[13px] text-ink-40 mt-3 px-1">
          {goal.links.length} investment{goal.links.length !== 1 ? 's' : ''} linked.
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-hairline">
        <button
          onClick={(e) => { e.stopPropagation(); setShowLinks(v => !v); }}
          className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-60 hover:text-green transition-colors cursor-pointer"
        >
          <LinkIcon className="h-4 w-4" />
          {goal.links.length > 0 ? "Manage links" : "Link a holding"}
        </button>
        <span className="text-hairline hidden sm:inline">|</span>
        <Link
          href={`/client/scenarios?goalId=${goal.id}&type=retire_earlier`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-60 hover:text-green transition-colors cursor-pointer"
        >
          <TrendingUp className="h-4 w-4" />
          Run scenario
        </Link>
        <span className="text-hairline hidden sm:inline">|</span>
        {confirmComplete ? (
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); markComplete(goal.id); setConfirmComplete(false); }} className="text-[13.5px] text-green font-bold cursor-pointer hover:underline">Yes, complete!</button>
            <button onClick={(e) => { e.stopPropagation(); setConfirmComplete(false); }} className="text-[13.5px] text-ink-40 cursor-pointer hover:text-ink-60">Cancel</button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmComplete(true); }}
            className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-60 hover:text-green transition-colors cursor-pointer"
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
          className="mt-4"
          message={{
            ...generateSolCopy({ type: "off_track", goalTitle: goal.title }),
            actionLabel: isTrackA ? "Run a scenario" : "See how an advisor can help",
          }}
          onAccept={() => {
            createLead.mutate("goal_scenario_cta"); // same CTA slot GoalScenarioCTA owns for at_risk
            setLocation(isTrackA ? `/client/scenarios?goalId=${goal.id}&type=retire_earlier` : "/client/messages");
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
    </GoalCard>
  );
}

export default function ClientGoals() {
  const {
    activeGoals, completedGoals, allGoals, goalsOnTrack, goalsAtRisk, goalsOffTrack,
    loading, plans, holdings, allLinks,
    addGoal, updateGoal, deleteGoal, markComplete, reopenGoal,
    addHoldingLink, removeHoldingLink,
  } = useGoals();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<EnrichedGoal | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("goals");

  // Handle ?newGoal=true URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("newGoal") === "true") setShowAdd(true);
  }, []);

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
        <div className="flex items-center justify-between mb-[4px]">
          <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em]">Goals</h1>
          {activeTab === "goals" && (
             <button 
               onClick={() => setShowAdd(true)}
               className="w-[36px] h-[36px] rounded-full bg-forest text-paper flex items-center justify-center text-[20px] leading-none cursor-pointer hover:bg-forest-700 transition-colors"
               aria-label="Add goal"
             >
               +
             </button>
          )}
        </div>

        <GoalsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "plan" ? (
          <PlanTab />
        ) : (
          <>
            <div className="text-[14px] text-ink-40 mb-[8px]">
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
              <div className="bg-surface rounded-[28px] py-16 px-6 text-center shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                <Target className="h-10 w-10 text-green mx-auto mb-3" />
                <h2 className="text-[16px] font-semibold text-forest mb-2">No goals yet</h2>
                <p className="text-[14px] text-ink-40 mb-5 max-w-xs mx-auto">
                  Set your first financial goal to start tracking progress.
                </p>
                <button
                  onClick={() => setShowAdd(true)}
                  className="px-5 py-2.5 rounded-full bg-green text-paper text-[14px] font-semibold hover:bg-forest transition-colors cursor-pointer"
                >
                  Set your first goal
                </button>
              </div>
            )}

            {/* Active goal cards */}
            {activeGoals.map(goal => (
              <GoalCardInline
                key={goal.id}
                goal={goal}
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
              />
            ))}

            {/* Completed goals section */}
            {completedGoals.length > 0 && (
              <div className="space-y-[14px] mt-6">
                <button
                  onClick={() => setCompletedOpen(v => !v)}
                  className="flex items-center gap-2 text-[15px] font-semibold text-ink-60 hover:text-forest transition-colors cursor-pointer"
                >
                  {completedOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  {completedGoals.length} completed {completedGoals.length === 1 ? "goal" : "goals"}
                </button>

                {completedOpen && (
                  <div className="space-y-[14px]">
                    {completedGoals.map(goal => {
                      const GOAL_ICONS: Record<string, React.ElementType> = {
                        retire: Palmtree, property: Home, education: GraduationCap, fire: Rocket,
                        business: Briefcase, emigrate: Globe, wealth: Coins, emergency: Shield, other: Target,
                      };
                      const Icon = GOAL_ICONS[goal.goalType] || Target;
                      return (
                        <div
                          key={goal.id}
                          className="bg-surface rounded-[24px] p-[16px_20px] flex items-center justify-between opacity-80 shadow-[0_2px_14px_rgba(20,52,42,.06)]"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                              <Icon className="w-6 h-6 text-green" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[16px] font-semibold text-forest truncate">{goal.title}</p>
                              <p className="text-[14px] text-ink-40">
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
                            className="px-4 py-2 rounded-full bg-black/5 text-forest text-[13px] font-semibold hover:bg-black/10 transition-colors ml-3 shrink-0 cursor-pointer"
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
          </>
        )}
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
