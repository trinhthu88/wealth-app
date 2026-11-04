import type { CheckpointCode } from "@workspace/tier-policy";
import { formatCurrency } from "@/lib/currencyUtils";

export interface CheckpointCopy {
  body: string;
  /** Null for a soft checkpoint with nothing to accept. */
  action: string | null;
}

const usd = (value: unknown) => formatCurrency(Number(value) || 0, "USD", true);

/**
 * Every checkpoint's words, in SOL_PERSONA.md's voice: what was observed, why it matters
 * in general, and an offer the user is free to ignore. Figures come only from the
 * checkpoint's server-written snapshot; nothing here tells anyone what to do with money.
 */
export function checkpointCopy(code: CheckpointCode, snapshot: Record<string, any>): CheckpointCopy {
  switch (code) {
    case "C1_score_ready":
      return {
        body: snapshot.weakest
          ? `Your first score is in. An advisor would look at ${snapshot.weakest} first, since it's your lowest area right now.`
          : "Your first score is in. It's a starting point you can come back to.",
        action: null,
      };
    case "C2_goal_slot":
      return {
        body: "The free plan covers one active goal. Clients plan every goal with an advisor, side by side.",
        action: "Talk to an advisor",
      };
    case "C3_off_track":
      return {
        body: snapshot.gapUsd
          ? `"${snapshot.goalTitle}" has been behind pace with ${usd(snapshot.gapUsd)} still to go. An advisor can look at the options with you.`
          : `"${snapshot.goalTitle}" has been behind pace. An advisor can look at the options with you.`,
        action: "Talk to an advisor",
      };
    case "C4_surplus":
      return {
        body: `You've kept about ${usd(snapshot.monthlySurplus)} a month unallocated. An advisor can show you what a regular savings plan does over time.`,
        action: "Talk to an advisor",
      };
    case "C5_investable":
      return {
        body: snapshot.holdingLabel
          ? `You expect ${snapshot.holdingLabel} to return ${Math.abs(Number(snapshot.deviationPp))} points below its benchmark. That's worth a second look with an advisor.`
          : `You're tracking ${usd(snapshot.portfolioValue)} across your holdings. An advisor can compare keeping this self-managed with bringing it under management.`,
        action: "Talk to an advisor",
      };
    case "C6_engaged":
      return snapshot.variant === "engaged_high"
        ? { body: `${snapshot.streakWeeks} weeks in a row and a score of ${snapshot.score}. The next step from here is usually a plan.`, action: "Talk to an advisor" }
        : { body: "You've been at this for three months. A second pair of eyes can help when a score stops moving.", action: "Talk to an advisor" };
    case "C7_direct":
      return { body: "An advisor can look through your goals and numbers with you.", action: "Talk to an advisor" };
    case "C8_plan_preview":
      return {
        body: `With about ${usd(snapshot.monthlySurplus)} a month to spare, an advisor can show you what an advised plan would look like for you.`,
        action: "Talk to an advisor",
      };
    case "C9_under_management":
      return {
        body: `You expect ${snapshot.holdingLabel} to return ${Math.abs(Number(snapshot.deviationPp))} points below its benchmark. Your advisor can compare it with an advised plan.`,
        action: "Message your advisor",
      };
    case "C11_trial_ending":
      return {
        body: `Your free trial ends on ${new Date(snapshot.trialEndsAt).toLocaleDateString(undefined, { day: "numeric", month: "long" })}, and your card is charged then unless you cancel.`,
        action: "Manage membership",
      };
    case "C12_lapsed":
      return {
        body: "Your membership has ended. All your goals and holdings are still here, and your advisor stays with you. You're back on the free plan's limits, so you can't add more until you reactivate.",
        action: "Reactivate",
      };
    case "C10_coast_point":
      return {
        body: `Your coast point for "${snapshot.goalTitle}" is the date you could stop contributing and still get there. An advisor can walk through it with you.`,
        action: "Talk to an advisor",
      };
  }
}
