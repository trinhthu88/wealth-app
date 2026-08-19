import { useState } from "react";
import { MoreHorizontal, Link as LinkIcon, TrendingUp, CheckCircle2, Pencil, Pause, Trash2, Palmtree, Home, GraduationCap, Rocket, Briefcase, Globe, Coins, Shield, Target } from "lucide-react";
import { Link } from "wouter";
import GoalStatusBadge from "./GoalStatusBadge";
import GoalProgressBar from "./GoalProgressBar";
import GoalHoldingLinks from "./GoalHoldingLinks";
import GoalScenarioCTA from "./GoalScenarioCTA";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import { cn } from "@/lib/utils";
import type { EnrichedGoal } from "@/hooks/useGoals";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import type { ClientHolding } from "@/hooks/useClientHoldings";

const GOAL_ICONS: Record<string, React.ElementType> = {
  retire: Palmtree, property: Home, education: GraduationCap, fire: Rocket,
  business: Briefcase, emigrate: Globe, wealth: Coins, emergency: Shield,
  other: Target,
};

function monthsAway(date: string): string {
  const now = new Date();
  const target = new Date(date);
  const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  if (months <= 0) return "past target date";
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""} away`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} yr ${rem} mo away` : `${years} year${years !== 1 ? "s" : ""} away`;
}

interface Props {
  goal: EnrichedGoal;
  plans: AdvisedPlan[];
  holdings: ClientHolding[];
  onEdit: (goal: EnrichedGoal) => void;
  onDelete: (id: string) => void;
  onMarkComplete: (id: string) => void;
  onAddLink: (params: { goalId: string; sourceType: string; sourceId: string; allocationPct: number }) => Promise<void>;
  onRemoveLink: (linkId: string) => Promise<void>;
}

export default function GoalCard({
  goal, plans, holdings, onEdit, onDelete, onMarkComplete, onAddLink, onRemoveLink,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const Icon = GOAL_ICONS[goal.goalType] || Target;
  const hasTarget = goal.targetAmountNum != null && goal.targetAmountNum > 0;

  // Build linked holdings display string
  const linkDescriptions = goal.links.map(link => {
    const pct = parseFloat(link.allocationPct) || 100;
    if (link.sourceType === "advised_plan") {
      const plan = plans.find(p => p.id === link.sourceId);
      if (!plan) return null;
      const value = parseFloat(plan.latestAccountValue) || 0;
      const allocatedValue = value * pct / 100;
      return `${plan.nickname ?? plan.productName} (${pct < 100 ? `${pct}% · ` : ""}`
        + `$${Math.round(allocatedValue).toLocaleString()})`;
    } else {
      const holding = holdings.find(h => h.id === link.sourceId);
      if (!holding) return null;
      const allocatedValue = holding.currentValue * pct / 100;
      return `${holding.label} (${pct < 100 ? `${pct}% · ` : ""}`
        + `$${Math.round(allocatedValue).toLocaleString()})`;
    }
  }).filter(Boolean);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <Icon className="w-6 h-6 text-[#1D9E75] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[#042C53] truncate">{goal.title}</h3>
            <GoalStatusBadge status={goal.trackStatus} />
          </div>
          {/* Meta */}
          <p className="text-xs text-slate-400 mt-0.5">
            {hasTarget ? (
              <>
                Target: <CurrencyDisplay amountUsd={goal.targetAmountNum!} compact />
                {goal.targetDate && (
                  <> by {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} · {monthsAway(goal.targetDate)}</>
                )}
              </>
            ) : goal.targetDate ? (
              <>Target date: {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} · no amount set</>
            ) : (
              <button onClick={() => onEdit(goal)} className="text-[#1D9E75] hover:underline">
                No target set yet — set one →
              </button>
            )}
          </p>
        </div>

        {/* Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1 text-sm">
                <button onClick={() => { onEdit(goal); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 text-[#042C53]">
                  <Pencil className="h-3.5 w-3.5 text-slate-400" /> Edit goal
                </button>
                <button onClick={() => { setShowMenu(false); /* pause handled by status */ }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 text-slate-600">
                  <Pause className="h-3.5 w-3.5 text-slate-400" /> Pause goal
                </button>
                <div className="border-t border-slate-100 my-1" />
                {confirmDelete ? (
                  <div className="px-3 py-2 space-y-1">
                    <p className="text-xs text-slate-500">Remove "{goal.title}"?</p>
                    <div className="flex gap-1">
                      <button onClick={() => { onDelete(goal.id); setShowMenu(false); }} className="flex-1 py-1 bg-red-500 text-white text-xs rounded-lg font-medium">Yes</button>
                      <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1 border border-slate-200 text-slate-500 text-xs rounded-lg">No</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-red-50 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" /> Delete goal
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <GoalProgressBar
        progressPct={goal.progressPct}
        currentAmount={goal.computedCurrentAmount}
        targetAmount={goal.targetAmountNum}
        hasLinks={goal.links.length > 0}
        onSetTarget={() => onEdit(goal)}
      />

      {/* Projection note for off-track */}
      {(goal.trackStatus === "off_track" || goal.trackStatus === "at_risk") && goal.projectedCompletionDate && (
        <p className="text-xs text-amber-600">
          At current rate, you'll reach this goal {goal.projectedCompletionDate}
          {goal.targetDate && ` — behind your target date.`}
        </p>
      )}

      {/* Linked holdings */}
      {linkDescriptions.length > 0 && (
        <p className="text-xs text-slate-400">
          Linked: {linkDescriptions.join(" + ")}
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-50">
        <button
          onClick={() => setShowLinks(v => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#1D9E75] transition-colors"
        >
          <LinkIcon className="h-3.5 w-3.5" />
          {goal.links.length > 0 ? "Manage links" : "Link a holding"}
        </button>
        <span className="text-slate-200">·</span>
        <Link
          href={`/client/scenarios?goalId=${goal.id}&type=retire_earlier`}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#1D9E75] transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Run scenario
        </Link>
        <span className="text-slate-200">·</span>
        {confirmComplete ? (
          <div className="flex items-center gap-1">
            <button onClick={() => { onMarkComplete(goal.id); setConfirmComplete(false); }} className="text-xs text-emerald-600 font-medium">Yes, complete!</button>
            <button onClick={() => setConfirmComplete(false)} className="text-xs text-slate-400">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmComplete(true)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark complete
          </button>
        )}
      </div>

      {/* Scenario CTA */}
      <GoalScenarioCTA goalId={goal.id} goalTitle={goal.title} status={goal.trackStatus} />

      {/* Holdings link panel */}
      {showLinks && (
        <GoalHoldingLinks
          goalId={goal.id}
          links={goal.links}
          plans={plans}
          holdings={holdings}
          onAddLink={onAddLink}
          onRemoveLink={onRemoveLink}
          onClose={() => setShowLinks(false)}
        />
      )}
    </div>
  );
}
