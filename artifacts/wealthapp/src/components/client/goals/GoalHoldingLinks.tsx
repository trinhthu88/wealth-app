import { useState } from "react";
import { X, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import SolCard from "./SolCard";
import { generateSolCopy, type SolMessage } from "@/lib/sol";
import { buildOverAllocationObservation } from "@/lib/solObservations";
import type { EnrichedGoal, GoalHoldingLink } from "@/hooks/useGoals";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  goalId: string;
  links: GoalHoldingLink[];
  // All of the client's goal-holding links, across every goal — used to compute
  // how much of each holding is already allocated elsewhere before letting the
  // client link more of it here. Defaults to `links` (this goal only) if omitted,
  // which just means cross-goal allocation can't be checked for that caller.
  allLinks?: GoalHoldingLink[];
  // All of the client's goals (any status) — only used to name the "other
  // goals" a holding is already linked to when Sol explains a blocked
  // over-allocation attempt. Falls back to no names (still explains the %) if omitted.
  goals?: EnrichedGoal[];
  plans: AdvisedPlan[];
  holdings: ClientHolding[];
  // Pre-fills and opens the allocation input for this specific source on
  // mount — used when the client taps a Sol suggestion card that already
  // named one candidate holding/plan, so they land straight in the confirm step.
  initialLinkTarget?: { sourceType: string; sourceId: string } | null;
  onAddLink: (params: { goalId: string; sourceType: string; sourceId: string; allocationPct: number }) => Promise<void>;
  onRemoveLink: (linkId: string) => Promise<void>;
  onClose: () => void;
}

export default function GoalHoldingLinks({ goalId, links, allLinks, goals, plans, holdings, initialLinkTarget, onAddLink, onRemoveLink, onClose }: Props) {
  const [linkingId, setLinkingId] = useState<string | null>(() =>
    initialLinkTarget ? `${initialLinkTarget.sourceType}:${initialLinkTarget.sourceId}` : null
  );
  // getRemainingPct is a hoisted function declaration (defined below) — safe to
  // call here since this initializer only runs during render.
  const [allocationPct, setAllocationPct] = useState(() =>
    initialLinkTarget
      ? Math.max(1, Math.min(100, getRemainingPct(initialLinkTarget.sourceType, initialLinkTarget.sourceId)))
      : 100
  );
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [solError, setSolError] = useState<{ key: string; remainingPct: number; message: SolMessage } | null>(null);

  const linkedIds = new Set(links.map(l => `${l.sourceType}:${l.sourceId}`));
  const crossGoalLinks = allLinks ?? links;

  const activePlans = plans.filter(p => p.status === "inforce" && p.isVisibleToClient);
  const investableHoldings = holdings.filter(h =>
    h.isActive && ["stock_etf", "crypto", "property", "pension", "cash"].includes(h.holdingType)
  );

  // How much of this holding is linked to OTHER goals (not the one we're viewing),
  // and how much is still available to allocate here. Mirrors the server-side check
  // in POST /client/goals/:id/links so the cap shown here always matches what the
  // server will actually accept.
  function getRemainingPct(sourceType: string, sourceId: string) {
    const allocatedElsewhere = crossGoalLinks
      .filter(l => l.sourceType === sourceType && l.sourceId === sourceId && l.goalId !== goalId)
      .reduce((sum, l) => sum + (parseFloat(l.allocationPct) || 0), 0);
    return Math.max(0, 100 - allocatedElsewhere);
  }

  function startLinking(key: string, remainingPct: number) {
    setLinkingId(key);
    setAllocationPct(Math.max(1, Math.min(100, remainingPct)));
    setSolError(null);
  }

  async function handleLink(sourceType: string, sourceId: string, holdingLabel: string) {
    const key = `${sourceType}:${sourceId}`;
    setSolError(null);
    try {
      await onAddLink({ goalId, sourceType, sourceId, allocationPct });
      setLinkingId(null);
      setAllocationPct(100);
    } catch (err: any) {
      const remaining = err?.remainingPct;
      if (typeof remaining !== "number") return; // other errors already surfaced via toast
      const observation = buildOverAllocationObservation(
        { goals: goals ?? [], allLinks: crossGoalLinks },
        { sourceType, sourceId, holdingLabel, remainingPct: remaining, excludeGoalId: goalId },
      );
      setSolError({ key, remainingPct: remaining, message: generateSolCopy(observation) });
    }
  }

  function getLinkForId(sourceType: string, sourceId: string) {
    return links.find(l => l.sourceType === sourceType && l.sourceId === sourceId);
  }

  return (
    <div className="mt-3 border border-[#E2E8F0] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFB] border-b border-[#E2E8F0]">
        <div>
          <p className="text-sm font-semibold text-[#042C53]">Link investments to this goal</p>
          <p className="text-xs text-slate-400 mt-0.5">Progress updates automatically from linked investments.</p>
        </div>
        <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
        {activePlans.length === 0 && investableHoldings.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No investments available to link.</p>
        )}

        {/* Advised plans */}
        {activePlans.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Advised plans</p>
            {activePlans.map(plan => {
              const key = `advised_plan:${plan.id}`;
              const isLinked = linkedIds.has(key);
              const link = getLinkForId("advised_plan", plan.id);
              const value = parseFloat(plan.latestAccountValue) || 0;
              const isLinking = linkingId === key;
              const remainingPct = getRemainingPct("advised_plan", plan.id);
              const isFullyAllocated = !isLinked && remainingPct <= 0;

              return (
                <div key={plan.id} className="flex items-center justify-between py-2 px-3 bg-white border border-slate-100 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#042C53] truncate">{plan.nickname ?? plan.productName}</p>
                    <p className="text-xs text-slate-400">
                      <CurrencyDisplay amountUsd={value} compact />
                      {link && ` · ${link.allocationPct}% allocated`}
                      {!isLinked && !isFullyAllocated && remainingPct < 100 && ` · ${remainingPct}% unallocated`}
                      {isFullyAllocated && " · fully allocated to other goals"}
                    </p>
                    {isLinking && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-slate-500 shrink-0">Allocation %:</label>
                        <input
                          type="number"
                          value={allocationPct}
                          onChange={e => setAllocationPct(Math.min(remainingPct, Math.max(1, parseInt(e.target.value) || 1)))}
                          min={1} max={remainingPct}
                          className="w-16 px-2 py-1 rounded-lg border border-[#1D9E75] text-sm text-center"
                        />
                        <span className="text-xs text-slate-400">of {remainingPct}% available</span>
                        <button
                          onClick={() => handleLink("advised_plan", plan.id, plan.nickname ?? plan.productName)}
                          className="px-3 py-1 bg-[#1D9E75] text-white text-xs rounded-lg font-medium"
                        >
                          Confirm
                        </button>
                        <button onClick={() => { setLinkingId(null); setSolError(null); }} className="text-xs text-slate-400">Cancel</button>
                      </div>
                    )}
                    {isLinking && solError?.key === key && (
                      <SolCard
                        className="mt-2"
                        message={solError.message}
                        onAccept={() => { setAllocationPct(solError.remainingPct); setSolError(null); }}
                      />
                    )}
                  </div>
                  {!isLinking && (
                    isLinked && link ? (
                      confirmRemove === link.id ? (
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button onClick={() => onRemoveLink(link.id).then(() => setConfirmRemove(null))} className="text-xs text-red-500 font-medium">Remove</button>
                          <button onClick={() => setConfirmRemove(null)} className="text-xs text-slate-400">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRemove(link.id)} className="ml-2 h-6 w-6 flex items-center justify-center rounded-full text-slate-300 hover:text-red-400 transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : isFullyAllocated ? (
                      <span className="ml-2 px-2.5 py-1 bg-slate-100 text-slate-400 text-xs rounded-lg font-medium shrink-0">Unavailable</span>
                    ) : (
                      <button
                        onClick={() => startLinking(key, remainingPct)}
                        className="ml-2 flex items-center gap-1 px-2.5 py-1 bg-[#1D9E75]/10 text-[#1D9E75] text-xs rounded-lg font-medium hover:bg-[#1D9E75]/20 transition-colors shrink-0"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Link
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Self-holdings */}
        {investableHoldings.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Self-held investments</p>
            {investableHoldings.map(holding => {
              const key = `self_holding:${holding.id}`;
              const isLinked = linkedIds.has(key);
              const link = getLinkForId("self_holding", holding.id);
              const isLinking = linkingId === key;
              const remainingPct = getRemainingPct("self_holding", holding.id);
              const isFullyAllocated = !isLinked && remainingPct <= 0;

              return (
                <div key={holding.id} className="flex items-center justify-between py-2 px-3 bg-white border border-slate-100 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#042C53] truncate">
                      {holding.label}{holding.ticker ? ` · ${holding.ticker}` : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      <CurrencyDisplay amountUsd={holding.currentValue} compact />
                      {" · "}{holding.holdingType.replace(/_/g, " ")}
                      {link && ` · ${link.allocationPct}% allocated`}
                      {!isLinked && !isFullyAllocated && remainingPct < 100 && ` · ${remainingPct}% unallocated`}
                      {isFullyAllocated && " · fully allocated to other goals"}
                    </p>
                    {isLinking && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-slate-500 shrink-0">Allocation %:</label>
                        <input
                          type="number"
                          value={allocationPct}
                          onChange={e => setAllocationPct(Math.min(remainingPct, Math.max(1, parseInt(e.target.value) || 1)))}
                          min={1} max={remainingPct}
                          className="w-16 px-2 py-1 rounded-lg border border-[#1D9E75] text-sm text-center"
                        />
                        <span className="text-xs text-slate-400">of {remainingPct}% available</span>
                        <button
                          onClick={() => handleLink("self_holding", holding.id, holding.ticker ? `${holding.label} · ${holding.ticker}` : holding.label)}
                          className="px-3 py-1 bg-[#1D9E75] text-white text-xs rounded-lg font-medium"
                        >
                          Confirm
                        </button>
                        <button onClick={() => { setLinkingId(null); setSolError(null); }} className="text-xs text-slate-400">Cancel</button>
                      </div>
                    )}
                    {isLinking && solError?.key === key && (
                      <SolCard
                        className="mt-2"
                        message={solError.message}
                        onAccept={() => { setAllocationPct(solError.remainingPct); setSolError(null); }}
                      />
                    )}
                  </div>
                  {!isLinking && (
                    isLinked && link ? (
                      confirmRemove === link.id ? (
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button onClick={() => onRemoveLink(link.id).then(() => setConfirmRemove(null))} className="text-xs text-red-500 font-medium">Remove</button>
                          <button onClick={() => setConfirmRemove(null)} className="text-xs text-slate-400">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmRemove(link.id)} className="ml-2 h-6 w-6 flex items-center justify-center rounded-full text-slate-300 hover:text-red-400 transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : isFullyAllocated ? (
                      <span className="ml-2 px-2.5 py-1 bg-slate-100 text-slate-400 text-xs rounded-lg font-medium shrink-0">Unavailable</span>
                    ) : (
                      <button
                        onClick={() => startLinking(key, remainingPct)}
                        className="ml-2 flex items-center gap-1 px-2.5 py-1 bg-[#1D9E75]/10 text-[#1D9E75] text-xs rounded-lg font-medium hover:bg-[#1D9E75]/20 transition-colors shrink-0"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Link
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
