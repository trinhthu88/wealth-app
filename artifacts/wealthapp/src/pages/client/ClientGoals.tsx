import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Plus, Target, ChevronDown, ChevronRight, Map, MoreHorizontal, Link as LinkIcon, TrendingUp, CheckCircle2, Pencil, Pause, Trash2, Palmtree, Home, GraduationCap, Rocket, Briefcase, Globe, Coins, Shield } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import GoalsSummaryBar from "@/components/client/goals/GoalsSummaryBar";
import AddGoalSheet from "@/components/client/goals/AddGoalSheet";
import EditGoalSheet from "@/components/client/goals/EditGoalSheet";
import GoalHoldingLinks from "@/components/client/goals/GoalHoldingLinks";
import GoalScenarioCTA from "@/components/client/goals/GoalScenarioCTA";
import PlanHeader from "@/components/client/plan/PlanHeader";
import ReviewCountdown from "@/components/client/plan/ReviewCountdown";
import PlanProgressRing from "@/components/client/plan/PlanProgressRing";
import PlanTimeline from "@/components/client/plan/PlanTimeline";
import RequestReviewSheet from "@/components/client/plan/RequestReviewSheet";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
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
    plan, milestones,
    completedCount, inProgressCount, upcomingCount, totalCount, completionPct,
    nextMilestone, daysUntilReview, isReviewOverdue,
    advisorName, advisorId, nextReviewDate,
    loading, statusGroup,
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

  if (!plan) {
    return (
      <div className="bg-surface shadow-[0_2px_14px_rgba(20,52,42,.06)] rounded-[28px] py-16 px-6 text-center">
        <Map className="h-10 w-10 text-green mx-auto mb-3" />
        <h2 className="text-[16px] font-semibold text-forest mb-1">
          Your financial plan hasn't been created yet.
        </h2>
        <p className="text-[14px] text-ink-40 mb-5">
          Your advisor will create a personalised plan for you.
        </p>
        <Link
          href="/client/messages"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green text-paper text-[14px] font-semibold hover:bg-forest transition-colors cursor-pointer"
        >
          Message your advisor →
        </Link>
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
            statusGroup={statusGroup}
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

function GoalCardInline({ goal, plans, holdings, setEditTarget, markComplete, deleteGoal, addHoldingLink, removeHoldingLink }: any) {
  const [showLinks, setShowLinks] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const isBehind = goal.trackStatus === "at_risk" || goal.trackStatus === "off_track";
  const isNearTerm = goal.monthsRemaining && goal.monthsRemaining < 36;
  
  let ringColor = "var(--green)";
  if (isBehind) ringColor = "var(--clay)";
  else if (isNearTerm) ringColor = "var(--sun)";

  const progressPct = goal.progressPct ?? 0;
  const circumference = 2 * Math.PI * 33;
  const offset = circumference - (Math.min(progressPct, 100) / 100) * circumference;

  return (
    <div className="bg-surface rounded-[28px] p-[20px_22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] mb-[14px] transition-colors relative">
      <div
        className="flex gap-[18px] items-center cursor-pointer rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
        onClick={() => setEditTarget(goal)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditTarget(goal);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${goal.title}`}
      >
        <div className="relative w-[76px] h-[76px] flex-none">
          <svg viewBox="0 0 80 80" className="w-[76px] h-[76px] -rotate-90">
            <circle cx="40" cy="40" r="33" fill="none" stroke="var(--track)" strokeWidth="9" />
            <circle 
              cx="40" cy="40" r="33" 
              fill="none" 
              stroke={ringColor} 
              strokeWidth="9" 
              strokeLinecap="round" 
              strokeDasharray={circumference} 
              strokeDashoffset={offset} 
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[20px] font-semibold text-forest leading-tight mb-1 truncate">
            {goal.title}
          </div>
          <div className="text-[13.5px] text-ink-40 mb-[6px]">
            {goal.targetDate ? new Date(goal.targetDate).getFullYear() : "Target not set"}
          </div>
          <div className="text-[15px] font-semibold text-forest tabular-nums">
            <CurrencyDisplay amountUsd={goal.computedCurrentAmount} />
            {goal.targetAmountNum ? (
              <span className="font-normal text-ink-30 ml-1">
                {" "}of <CurrencyDisplay amountUsd={goal.targetAmountNum} />
              </span>
            ) : null}
          </div>
        </div>
        
        {/* Menu Toggle */}
        <div className="relative shrink-0 self-start">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="h-8 w-8 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div className="absolute right-0 top-10 z-20 w-48 bg-surface border border-hairline rounded-[16px] shadow-[0_4px_20px_rgba(0,0,0,.08)] py-2 text-[14px]">
                <button onClick={(e) => { e.stopPropagation(); setEditTarget(goal); setShowMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-black/5 text-forest cursor-pointer">
                  <Pencil className="h-4 w-4 text-ink-40" /> Edit goal
                </button>
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-black/5 text-ink-60 cursor-pointer">
                  <Pause className="h-4 w-4 text-ink-40" /> Pause goal
                </button>
                <div className="border-t border-hairline my-1.5" />
                {confirmDelete ? (
                  <div className="px-4 py-2 space-y-2">
                    <p className="text-[13px] text-clay font-medium">Remove "{goal.title}"?</p>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); setShowMenu(false); }} className="flex-1 py-1.5 bg-clay text-white text-[13px] rounded-lg font-semibold cursor-pointer hover:bg-red-600 transition-colors">Yes</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="flex-1 py-1.5 border border-hairline text-ink-60 text-[13px] rounded-lg font-medium cursor-pointer hover:bg-black/5 transition-colors">No</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-clay-tint text-clay cursor-pointer">
                    <Trash2 className="h-4 w-4" /> Delete goal
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

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

      <div className="mt-4">
        <GoalScenarioCTA goalId={goal.id} goalTitle={goal.title} status={goal.trackStatus} />
      </div>

      {showLinks && (
        <div className="mt-4">
          <GoalHoldingLinks
            goalId={goal.id}
            links={goal.links}
            plans={plans}
            holdings={holdings}
            onAddLink={(p) => addHoldingLink(p).then(() => {})}
            onRemoveLink={(id) => removeHoldingLink(id).then(() => {})}
            onClose={() => setShowLinks(false)}
          />
        </div>
      )}
    </div>
  );
}

export default function ClientGoals() {
  const {
    activeGoals, completedGoals, goalsOnTrack, goalsAtRisk, goalsOffTrack,
    loading, plans, holdings,
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
              {totalActive} live · <CurrencyDisplay amountUsd={totalValue} compact showSign={false} /> in play
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
