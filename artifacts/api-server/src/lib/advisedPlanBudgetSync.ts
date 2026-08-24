import { and, eq } from "drizzle-orm";
import { db, advisedPlansTable, clientBudgetMonthsTable } from "@workspace/db";

type Dbc = typeof db;

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7) + "-01";
}

function addMonths(monthStr: string, n: number) {
  const d = new Date(monthStr + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7) + "-01";
}

function monthsBetween(from: string, to: string) {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/**
 * Recomputes the client's current live set of in-force RSP contributions and
 * merges them into every client_budget_months row from fromMonth..toMonth
 * (inclusive), preserving each month's income/expense fields and any
 * non-"advised_plan" investmentContributions entries (manual / self_holding).
 * Writes clientBudgetMonthsTable directly rather than going through
 * POST /client/budget, which would zero out any field not resent.
 *
 * fromMonth defaults to toMonth (a single-month "live sync" — the behavior
 * POST /client/budget/sync-contributions has always had). toMonth defaults to
 * the current calendar month.
 */
export async function syncAdvisedPlanContributionsToBudget(dbc: Dbc, params: {
  userId: string;
  fromMonth?: string;
  toMonth?: string;
}) {
  const toMonth = params.toMonth ?? currentMonthStr();
  const fromMonth = params.fromMonth ?? toMonth;

  const plans = await dbc.select({
    id: advisedPlansTable.id,
    nickname: advisedPlansTable.nickname,
    productName: advisedPlansTable.productName,
    annualPremium: advisedPlansTable.annualPremium,
    planType: advisedPlansTable.planType,
  }).from(advisedPlansTable)
    .where(and(eq(advisedPlansTable.userId, params.userId), eq(advisedPlansTable.status, "inforce")));

  const advisedPlanContributions = plans
    .filter(p => p.planType === "rsp" && parseFloat(p.annualPremium as string) > 0)
    .map(p => ({
      label: p.nickname ?? p.productName,
      amount: Math.round(parseFloat(p.annualPremium as string) / 12),
      source_id: p.id,
      source_type: "advised_plan",
    }));

  const months = monthsBetween(fromMonth, toMonth);
  const syncedMonths: string[] = [];

  for (const month of months) {
    const [existing] = await dbc.select().from(clientBudgetMonthsTable)
      .where(and(eq(clientBudgetMonthsTable.userId, params.userId), eq(clientBudgetMonthsTable.month, month)));

    const preserved = ((existing?.investmentContributions as any[]) ?? [])
      .filter((c: any) => c?.source_type !== "advised_plan");
    const nextContributions = [...preserved, ...advisedPlanContributions];
    const totalInvestments = nextContributions.reduce((sum, c) => sum + (c.amount || 0), 0);

    if (existing) {
      const totalIncome = parseFloat(existing.totalIncome);
      const totalExpenses = parseFloat(existing.totalExpenses);
      const netSurplus = totalIncome - totalExpenses - totalInvestments;
      const savingsRatePct = totalIncome > 0 ? (netSurplus / totalIncome) * 100 : 0;
      await dbc.update(clientBudgetMonthsTable).set({
        investmentContributions: nextContributions,
        totalInvestments: String(totalInvestments),
        netSurplus: String(netSurplus),
        savingsRatePct: String(savingsRatePct),
        updatedAt: new Date(),
      }).where(eq(clientBudgetMonthsTable.id, existing.id));
    } else {
      const netSurplus = -totalInvestments;
      await dbc.insert(clientBudgetMonthsTable).values({
        userId: params.userId,
        month,
        investmentContributions: nextContributions,
        totalInvestments: String(totalInvestments),
        netSurplus: String(netSurplus),
      });
    }
    syncedMonths.push(month);
  }

  return { syncedMonths, contributions: advisedPlanContributions };
}
