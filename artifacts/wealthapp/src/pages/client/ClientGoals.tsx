// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: BottomSheet spring animation
// ✓ ALLOWED: Single new goal card appearing in list after add (opacity 0→1, 150ms)
// ✗ BANNED:  Page-load stagger on goal cards
// ✗ BANNED:  Progress bar width animation on page load (bars render at final width)

import { useState, useEffect } from "react";
import { Plus, Target, ChevronDown, ChevronRight } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import GoalsSummaryBar from "@/components/client/goals/GoalsSummaryBar";
import GoalCard from "@/components/client/goals/GoalCard";
import AddGoalSheet from "@/components/client/goals/AddGoalSheet";
import EditGoalSheet from "@/components/client/goals/EditGoalSheet";
import { useGoals, type EnrichedGoal } from "@/hooks/useGoals";
import { cn } from "@/lib/utils";

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

  // Handle ?newGoal=true URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("newGoal") === "true") setShowAdd(true);
  }, []);

  const totalActive = activeGoals.length;

  if (loading) {
    return (
      <ClientAppShell>
        <div className="max-w-[860px] mx-auto space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-36 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </ClientAppShell>
    );
  }

  return (
    <ClientAppShell>
      <div className="max-w-[860px] mx-auto space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#042C53]">Your goals</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#0F6E56] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add goal
          </button>
        </div>

        {/* Summary bar */}
        <GoalsSummaryBar
          totalActive={totalActive}
          onTrack={goalsOnTrack}
          atRisk={goalsAtRisk}
          offTrack={goalsOffTrack}
        />

        {/* Empty state */}
        {totalActive === 0 && completedGoals.length === 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl py-16 px-6 text-center">
            <Target className="h-10 w-10 text-[#1D9E75] mx-auto mb-3" />
            <h2 className="text-base font-semibold text-[#042C53] mb-1">No goals yet</h2>
            <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
              Set your first financial goal and start tracking your progress.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#0F6E56] transition-colors"
            >
              Set your first goal
            </button>
          </div>
        )}

        {/* Active goal cards */}
        {activeGoals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            plans={plans}
            holdings={holdings}
            onEdit={setEditTarget}
            onDelete={(id) => void deleteGoal(id)}
            onMarkComplete={(id) => void markComplete(id)}
            onAddLink={(p) => addHoldingLink(p).then(() => {})}
            onRemoveLink={(id) => removeHoldingLink(id).then(() => {})}
          />
        ))}

        {/* Completed goals section */}
        {completedGoals.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setCompletedOpen(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#042C53] transition-colors"
            >
              {completedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {completedGoals.length} completed {completedGoals.length === 1 ? "goal" : "goals"}
            </button>

            {completedOpen && (
              <div className="space-y-2">
                {completedGoals.map(goal => {
                  const GOAL_EMOJIS: Record<string, string> = {
                    retire: "🌴", property: "🏠", education: "📚", fire: "🚀",
                    business: "💼", emigrate: "🌍", wealth: "💰", emergency: "🛡️", other: "🎯",
                  };
                  return (
                    <div
                      key={goal.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between opacity-70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl">{GOAL_EMOJIS[goal.goalType] ?? "🎯"}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-600 truncate">{goal.title}</p>
                          <p className="text-xs text-slate-400">
                            {goal.targetAmountNum
                              ? `$${Math.round(goal.targetAmountNum).toLocaleString()} reached`
                              : "Completed"}
                            {(goal as any).completedAt
                              ? ` · ${new Date((goal as any).completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                              : ""} ✓
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => reopenGoal(goal.id)}
                        className="text-xs text-slate-400 hover:text-[#1D9E75] ml-3 shrink-0"
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
