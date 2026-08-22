import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, financialGoalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { resolveBlendedRate } from "../lib/blendedRate";
import { solveCoastPoint } from "@workspace/goal-math";

const router: IRouter = Router();

// GET /client/plan/coast-point?extraMonthly=0
// Real numbers only: blended rate from resolveBlendedRate(), retirement goal from
// the client's own financial_goals row (goalType='retire' — the id used by the
// investment-client "Add Goal" sheet, see AddGoalSheet.tsx's GOAL_TYPES; not the
// string "retirement"), current value from the same holdings/plans just weighted
// above. extraMonthly, if provided, re-solves with monthlyContribution bumped by
// that amount so Sol can show a real "what if I added $X/month" comparison — never
// an invented before/after pair.
router.get("/client/plan/coast-point", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const extraMonthly = Math.max(0, parseFloat(String(req.query.extraMonthly ?? "0")) || 0);

  const [goal] = await db.select().from(financialGoalsTable)
    .where(and(eq(financialGoalsTable.userId, userId), eq(financialGoalsTable.goalType, "retire")));

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
    blendedAnnualReturnPct: Math.round(ratePct * 10) / 10,
    portfolioValue: Math.round(totalValue),
    base,
    accelerated,
    extraMonthly,
  });
});

export default router;
