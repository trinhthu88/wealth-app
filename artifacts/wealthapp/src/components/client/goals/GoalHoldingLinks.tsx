import { useState } from "react";
import { X, Link as LinkIcon } from "lucide-react";
import CurrencyField from "@/components/shared/CurrencyField";
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
    <div className="mt-3 bg-paper rounded-[24px] overflow-hidden text-forest">
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div>
          <p className="text-[16px] font-semibold text-forest">Link investments to this goal</p>
          <p className="text-[13px] text-ink-40 mt-0.5">Progress updates automatically from linked investments.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close investment links" data-testid={`button-close-goal-links-${goalId}`} className="-mt-2 -mr-2 h-11 w-11 shrink-0 flex items-center justify-center rounded-full text-ink-40 hover:text-forest hover:bg-surface transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-4 max-h-80 overflow-y-auto">
        {activePlans.length === 0 && investableHoldings.length === 0 && (
          <p className="text-[14px] text-ink-40 text-center py-4">No investments available to link.</p>
        )}

        {/* Advised plans */}
        {activePlans.length > 0 && (
          <div className="space-y-2">
            <p className="tala-eyebrow text-ink-40">Advised plans</p>
            {activePlans.map(plan => {
              const key = `advised_plan:${plan.id}`;
              const isLinked = linkedIds.has(key);
              const link = getLinkForId("advised_plan", plan.id);
              const value = parseFloat(plan.latestAccountValue) || 0;
              const isLinking = linkingId === key;
              const remainingPct = getRemainingPct("advised_plan", plan.id);
              const isFullyAllocated = !isLinked && remainingPct <= 0;

              return (
                <div key={plan.id} className="flex items-center justify-between p-3 bg-surface rounded-[14px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-forest truncate">{plan.nickname ?? plan.productName}</p>
                    <p className="text-[12px] text-ink-40 tabular-nums">
                      <CurrencyField amountUsd={value} compact />
                      {link && ` · ${link.allocationPct}% allocated`}
                      {!isLinked && !isFullyAllocated && remainingPct < 100 && ` · ${remainingPct}% unallocated`}
                      {isFullyAllocated && " · fully allocated to other goals"}
                    </p>
                    {isLinking && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="text-[12px] text-ink-40 shrink-0">Allocation %:</label>
                        <input
                          type="number"
                          aria-label={`Allocation percentage for ${plan.nickname ?? plan.productName}`}
                          data-testid={`input-link-allocation-plan-${plan.id}`}
                          value={allocationPct}
                          onChange={e => setAllocationPct(Math.min(remainingPct, Math.max(1, parseInt(e.target.value) || 1)))}
                          min={1} max={remainingPct}
                          className="w-16 h-9 px-2 rounded-[10px] bg-paper border-[1.5px] border-forest text-[14px] text-forest text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-forest/30"
                        />
                        <span className="text-[12px] text-ink-40">of {remainingPct}% available</span>
                        <button
                          type="button"
                          onClick={() => handleLink("advised_plan", plan.id, plan.nickname ?? plan.productName)}
                          data-testid={`button-confirm-link-plan-${plan.id}`}
                          className="h-9 px-4 bg-forest text-paper text-[13px] rounded-full font-semibold hover:bg-forest-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button type="button" onClick={() => { setLinkingId(null); setSolError(null); }} data-testid={`button-cancel-link-plan-${plan.id}`} className="h-9 px-2 text-[13px] font-medium text-ink-40 hover:text-forest">Cancel</button>
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
                          <button type="button" onClick={() => onRemoveLink(link.id).then(() => setConfirmRemove(null))} data-testid={`button-remove-plan-link-${link.id}`} className="h-9 px-2 text-[13px] text-red-600 font-semibold">Remove</button>
                          <button type="button" onClick={() => setConfirmRemove(null)} data-testid={`button-cancel-remove-plan-link-${link.id}`} className="h-9 px-2 text-[13px] text-ink-40 hover:text-forest">No</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmRemove(link.id)} aria-label={`Remove ${plan.nickname ?? plan.productName} link`} data-testid={`button-prepare-remove-plan-link-${link.id}`} className="ml-2 h-9 w-9 flex items-center justify-center rounded-full text-ink-40 hover:text-red-600 hover:bg-paper transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : isFullyAllocated ? (
                      <span className="ml-2 px-2.5 py-1 bg-paper text-ink-40 text-[12px] rounded-full font-semibold shrink-0">Unavailable</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startLinking(key, remainingPct)}
                        data-testid={`button-link-plan-${plan.id}`}
                        className="ml-2 flex items-center gap-1.5 h-9 px-3.5 bg-forest text-paper text-[13px] rounded-full font-semibold hover:bg-forest-700 transition-colors shrink-0"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
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
            <p className="tala-eyebrow text-ink-40">Self-held investments</p>
            {investableHoldings.map(holding => {
              const key = `self_holding:${holding.id}`;
              const isLinked = linkedIds.has(key);
              const link = getLinkForId("self_holding", holding.id);
              const isLinking = linkingId === key;
              const remainingPct = getRemainingPct("self_holding", holding.id);
              const isFullyAllocated = !isLinked && remainingPct <= 0;

              return (
                <div key={holding.id} className="flex items-center justify-between p-3 bg-surface rounded-[14px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-forest truncate">
                      {holding.label}{holding.ticker ? ` · ${holding.ticker}` : ""}
                    </p>
                    <p className="text-[12px] text-ink-40 tabular-nums">
                      <CurrencyField amountUsd={holding.currentValue} compact />
                      {" · "}{holding.holdingType.replace(/_/g, " ")}
                      {link && ` · ${link.allocationPct}% allocated`}
                      {!isLinked && !isFullyAllocated && remainingPct < 100 && ` · ${remainingPct}% unallocated`}
                      {isFullyAllocated && " · fully allocated to other goals"}
                    </p>
                    {isLinking && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="text-[12px] text-ink-40 shrink-0">Allocation %:</label>
                        <input
                          type="number"
                          aria-label={`Allocation percentage for ${holding.label}`}
                          data-testid={`input-link-allocation-holding-${holding.id}`}
                          value={allocationPct}
                          onChange={e => setAllocationPct(Math.min(remainingPct, Math.max(1, parseInt(e.target.value) || 1)))}
                          min={1} max={remainingPct}
                          className="w-16 h-9 px-2 rounded-[10px] bg-paper border-[1.5px] border-forest text-[14px] text-forest text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-forest/30"
                        />
                        <span className="text-[12px] text-ink-40">of {remainingPct}% available</span>
                        <button
                          type="button"
                          onClick={() => handleLink("self_holding", holding.id, holding.ticker ? `${holding.label} · ${holding.ticker}` : holding.label)}
                          data-testid={`button-confirm-link-holding-${holding.id}`}
                          className="h-9 px-4 bg-forest text-paper text-[13px] rounded-full font-semibold hover:bg-forest-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button type="button" onClick={() => { setLinkingId(null); setSolError(null); }} data-testid={`button-cancel-link-holding-${holding.id}`} className="h-9 px-2 text-[13px] font-medium text-ink-40 hover:text-forest">Cancel</button>
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
                          <button type="button" onClick={() => onRemoveLink(link.id).then(() => setConfirmRemove(null))} data-testid={`button-remove-holding-link-${link.id}`} className="h-9 px-2 text-[13px] text-red-600 font-semibold">Remove</button>
                          <button type="button" onClick={() => setConfirmRemove(null)} data-testid={`button-cancel-remove-holding-link-${link.id}`} className="h-9 px-2 text-[13px] text-ink-40 hover:text-forest">No</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmRemove(link.id)} aria-label={`Remove ${holding.label} link`} data-testid={`button-prepare-remove-holding-link-${link.id}`} className="ml-2 h-9 w-9 flex items-center justify-center rounded-full text-ink-40 hover:text-red-600 hover:bg-paper transition-colors shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : isFullyAllocated ? (
                      <span className="ml-2 px-2.5 py-1 bg-paper text-ink-40 text-[12px] rounded-full font-semibold shrink-0">Unavailable</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startLinking(key, remainingPct)}
                        data-testid={`button-link-holding-${holding.id}`}
                        className="ml-2 flex items-center gap-1.5 h-9 px-3.5 bg-forest text-paper text-[13px] rounded-full font-semibold hover:bg-forest-700 transition-colors shrink-0"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
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
