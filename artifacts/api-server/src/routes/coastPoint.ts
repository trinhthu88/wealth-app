import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, financialGoalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveBlendedRate } from "../lib/blendedRate";
import { solveCoastPoint } from "@workspace/goal-math";

const router: IRouter = Router();

// Two live conventions exist for a retirement goal's goalType, and they've
// diverged: the current "Add Goal" UI (AddGoalSheet.tsx / Phase3Screen6Goal.tsx)
// writes "retire", but demo/seed data (scripts/seed-demo-data.ts) writes
// "retirement" — confirmed by a real account carrying both goalType values
// across its retirement goals. Matching only one silently misses real goals
// created via the other path, so this matches both until that divergence is
// fixed at the source.
const RETIREMENT_GOAL_TYPES = ["retire", "retirement"];

// When a client has more than one matching goal (the duplicate-type situation
// above, or a client who genuinely created two retirement-labeled goals), pick
// deterministically rather than taking whatever order Postgres happens to
// return — an unordered pick silently disappears the coast-point card or
// (worse) shows one goal's title next to another goal's numbers. Prefer a goal
// with both a target amount and date set (an incomplete goal can't drive the
// math at all); among complete candidates, prefer the furthest-out target
// date, since retirement is normally the last milestone on the pathway.
function pickRetirementGoal<T extends { targetAmount: string | null; targetDate: string | null }>(goals: T[]): T | null {
  const usable = goals.filter(g => g.targetAmount && g.targetDate);
  if (usable.length === 0) return null;
  return usable.reduce((latest, g) => (new Date(g.targetDate!) > new Date(latest.targetDate!) ? g : latest));
}

// GET /client/plan/coast-point?extraMonthly=0
// Real numbers only: blended rate from resolveBlendedRate(), retirement goal from
// the client's own financial_goals row, current value from the same holdings/plans
// just weighted above. extraMonthly, if provided, re-solves with monthlyContribution
// bumped by that amount so Sol can show a real "what if I added $X/month"
// comparison — never an invented before/after pair.
router.get("/client/plan/coast-point", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const extraMonthly = Math.max(0, parseFloat(String(req.query.extraMonthly ?? "0")) || 0);

  const candidates = await db.select().from(financialGoalsTable)
    .where(and(eq(financialGoalsTable.userId, userId), inArray(financialGoalsTable.goalType, RETIREMENT_GOAL_TYPES)));
  const goal = pickRetirementGoal(candidates);

  if (!goal || !goal.targetAmount || !goal.targetDate) {
    res.json({ available: false, reason: "no_retirement_goal" });
    return;
  }

  const { ratePct, totalValue } = await resolveBlendedRate(userId);
  const monthlyContribution = parseFloat(goal.monthlyContribution ?? "0") || 0;

  const base = solveCoastPoint({
    currentValue: totalValue,
    targetAmount: parseFloat(goal.targetAmount),
    targetDate: goal.targetDate,
    monthlyContribution,
    blendedAnnualReturnPct: ratePct,
  });

  const accelerated = extraMonthly > 0
    ? solveCoastPoint({
        currentValue: totalValue,
        targetAmount: parseFloat(goal.targetAmount),
        targetDate: goal.targetDate,
        monthlyContribution: monthlyContribution + extraMonthly,
        blendedAnnualReturnPct: ratePct,
      })
    : null;

  res.json({
    available: true,
    goalId: goal.id,
    goalTitle: goal.title,
    goalTargetDate: goal.targetDate,
    monthlyContribution,
    blendedAnnualReturnPct: Math.round(ratePct * 10) / 10,
    portfolioValue: Math.round(totalValue),
    base,
    accelerated,
    extraMonthly,
  });
});

export default router;
