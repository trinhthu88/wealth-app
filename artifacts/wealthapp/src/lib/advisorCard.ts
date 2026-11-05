import type { Tier } from "@workspace/tier-policy";

export type AdvisorCardState = "none" | "matching" | "assigned" | "client" | "activate";

/** What the dashboard's advisor card shows, from the server's lead status and advisor. */
export function advisorCardState(
  tier: Tier,
  leadStatus: string | null,
  hasAdvisor: boolean,
  pendingPayment = false,
): AdvisorCardState {
  if (pendingPayment) return "activate";
  // A member with no advisor yet came through the self-serve door and is waiting on assignment.
  if (tier !== "free") return hasAdvisor ? "client" : "matching";
  switch (leadStatus) {
    case "unassigned":
      return "matching";
    case "active":
      // An active lead with no advisor resolved is still being matched.
      return hasAdvisor ? "assigned" : "matching";
    case "client":
      return "client";
    default:
      return "none";
  }
}

const ACCEPTED_CHECKPOINT_COPY: Record<string, string> = {
  C2_goal_slot: "You asked about planning more than one goal.",
  C3_off_track: "You asked about getting your goal back on track.",
  C4_surplus: "You asked what your monthly surplus could do.",
  C5_investable: "You asked about your investments.",
  C6_engaged: "You asked for a second pair of eyes on your plan.",
  C7_direct: "You asked to talk to an advisor.",
  C8_plan_preview: "You asked what an advised plan would look like.",
  C9_under_management: "You asked about bringing your holdings under management.",
  C10_coast_point: "You asked about your coast point.",
  self_serve_member: "You joined as a member.",
};

export function acceptedCheckpointCopy(source: string | null): string | null {
  return source ? ACCEPTED_CHECKPOINT_COPY[source] ?? null : null;
}
