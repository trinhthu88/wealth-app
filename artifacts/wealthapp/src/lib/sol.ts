// Sol's phrasing layer — see SOL_PERSONA.md at the repo root for the full voice
// and advice-boundary brief this must follow. This module only phrases numbers
// it's handed; it never computes one (that's solObservations.ts and the backend
// goalAllocation.ts / goalProgressSnapshot.ts).
//
// generateSolCopy is the extension point: today it's a synchronous template
// switch. If an ANTHROPIC_API_KEY becomes available, swap this for a call to a
// backend Sol service (built from this same persona brief) without changing any
// call site — they already just want a SolMessage back for an observation.

export interface SolMessage {
  body: string;
  actionLabel?: string;
}

export type SolObservation =
  | { type: "unallocated_holding"; holdingLabel: string; amountUsd: number; goalNames: string[] }
  | { type: "newly_added_holding"; holdingLabel: string; amountUsd: number; daysAgo: number; goalNames: string[] }
  | { type: "over_allocation_blocked"; holdingLabel: string; remainingPct: number; otherGoalNames: string[] }
  | { type: "progress_movement"; goalTitle: string; deltaTotal: number; marketDelta: number; contributionDelta: number; reallocationDelta: number; fromDate: string; toDate: string }
  | { type: "off_track"; goalTitle: string };

// Below this, a move isn't worth Sol narrating — "Sol shouldn't narrate every $10
// fluctuation" (SOL_PERSONA.md / phase 3 note).
export const NEGLIGIBLE_PROGRESS_MOVEMENT_USD = 25;

export function isProgressMovementNoteworthy(movement: { deltaTotal: number }): boolean {
  return Math.abs(movement.deltaTotal) >= NEGLIGIBLE_PROGRESS_MOVEMENT_USD;
}

function formatUsd(amount: number): string {
  return `$${Math.round(Math.abs(amount)).toLocaleString()}`;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "your other goals";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

// Snapshots are only taken passively, on view — the gap between two of them can
// be a day or a month. Sol has to name that span rather than always saying
// "recently," or a multi-week diff reads as if it just happened.
function describeElapsed(fromDate: string, toDate: string): string {
  const days = Math.max(1, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86_400_000));
  if (days <= 1) return "today";
  if (days < 14) return `over the past ${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `over the past ${weeks} weeks`;
  const months = Math.max(1, Math.round(days / 30));
  return `over the past ${months} month${months === 1 ? "" : "s"}`;
}

export function generateSolCopy(observation: SolObservation): SolMessage {
  switch (observation.type) {
    case "unallocated_holding":
      return {
        body: `I noticed your ${observation.holdingLabel} (${formatUsd(observation.amountUsd)}) isn't linked to a goal yet — none of it's counting toward ${joinNames(observation.goalNames)}. Want to link some or all of it?`,
        actionLabel: "Choose how much to link",
      };

    case "newly_added_holding":
      return {
        body: `You just added ${observation.holdingLabel} (${formatUsd(observation.amountUsd)}). Want to link some or all of it toward ${joinNames(observation.goalNames)}?`,
        actionLabel: "Choose how much to link",
      };

    case "over_allocation_blocked": {
      if (observation.remainingPct <= 0) {
        return {
          body: `This ${observation.holdingLabel} is already fully allocated across ${joinNames(observation.otherGoalNames)} — there's nothing left to link here.`,
        };
      }
      const allocatedElsewhere = 100 - observation.remainingPct;
      return {
        body: `This ${observation.holdingLabel}'s other ${allocatedElsewhere}% is already working toward ${joinNames(observation.otherGoalNames)}. You've got ${observation.remainingPct}% left to allocate here.`,
        actionLabel: `Link ${observation.remainingPct}%`,
      };
    }

    case "progress_movement": {
      const direction = observation.deltaTotal >= 0 ? "grew" : "dropped";
      const drivers = [
        { key: "market", value: Math.abs(observation.marketDelta) },
        { key: "contribution", value: Math.abs(observation.contributionDelta) },
        { key: "reallocation", value: Math.abs(observation.reallocationDelta) },
      ].sort((a, b) => b.value - a.value);
      const reason = drivers[0].key === "market"
        ? "mostly market movement, not new money"
        : drivers[0].key === "contribution"
        ? "a new investment you linked, not the market moving"
        : "reallocating funds between goals";
      return {
        body: `Your ${observation.goalTitle} ${direction} by ${formatUsd(observation.deltaTotal)} ${describeElapsed(observation.fromDate, observation.toDate)} — ${reason}.`,
      };
    }

    case "off_track":
      return {
        body: `Your ${observation.goalTitle} has fallen behind pace. Want to see what closing the gap would take?`,
        actionLabel: "Run a scenario",
      };
  }
}
