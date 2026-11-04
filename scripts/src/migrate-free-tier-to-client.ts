// Moves what the retired free pages stored into the tables the client screens read.
// Idempotent and safe by default: without --apply it only reports what it would do.
//   1. budget_entries → client_budget_months (runs migrate-free-budget-entries.ts)
//   2. pathway step formData → any still-empty owner row
// Only ever fills an empty owner; never overwrites something the user has entered.
// Add --user=<id> to scope a run. Run with --apply on every environment before
// budget_entries and pathway_progress are dropped.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db, pool, assetsTable, clientBudgetMonthsTable, clientProfilesTable, financialGoalsTable,
  liabilitiesTable, normalizeRiskProfile, pathwayProgressTable, profilesTable,
} from "@workspace/db";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const onlyUsers = args.filter((a) => a.startsWith("--user=")).map((a) => a.slice("--user=".length));

const here = path.dirname(fileURLToPath(import.meta.url));
const budgetOutput = execFileSync(
  path.join(here, "../node_modules/.bin/tsx"),
  [path.join(here, "migrate-free-budget-entries.ts"), ...args],
  { env: process.env, encoding: "utf8" },
);
process.stdout.write(budgetOutput);

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

const counts = { users: 0, budgetMonths: 0, goals: 0, assets: 0, liabilities: 0, riskProfiles: 0, profileFields: 0 };

try {
  const rows = await db.select().from(pathwayProgressTable).where(
    onlyUsers.length ? inArray(pathwayProgressTable.userId, onlyUsers) : sql`true`,
  );
  const byUser = new Map<string, typeof rows>();
  for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);

  for (const [userId, steps] of byUser) {
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    // Only free users' wizard data is unmigrated; a client's owner rows are already theirs.
    if (profile?.role !== "free_user") continue;
    counts.users += 1;
    const step = (n: number) => (steps.find((s) => s.stepNumber === n)?.formData ?? {}) as Record<string, unknown>;

    // Step 1: identity. Age is not turned into a date of birth; that would invent one.
    const s1 = step(1);
    const profileUpdates: Record<string, unknown> = {};
    if (s1.isExpat === true && !profile.isExpat) profileUpdates.isExpat = true;
    if (typeof s1.currency === "string" && s1.currency !== "USD" && (!profile.preferredCurrency || profile.preferredCurrency === "USD")) {
      profileUpdates.preferredCurrency = s1.currency;
    }
    if (Object.keys(profileUpdates).length > 0) {
      counts.profileFields += Object.keys(profileUpdates).length;
      if (apply) await db.update(profilesTable).set(profileUpdates).where(eq(profilesTable.id, userId));
    }

    // Steps 2 and 3: a first budget month, dated when the user entered it.
    const s2 = step(2);
    const s3 = step(3);
    const income = num(s2.income);
    const expenseFields = { housing: num(s3.housing), foodDining: num(s3.food), transport: num(s3.transport), utilities: num(s3.utilities), entertainment: num(s3.entertainment), otherExpenses: num(s3.other) };
    const expenses = Object.values(expenseFields).reduce((a, b) => a + b, 0);
    const [anyMonth] = await db.select({ id: clientBudgetMonthsTable.id }).from(clientBudgetMonthsTable)
      .where(eq(clientBudgetMonthsTable.userId, userId)).limit(1);
    if (!anyMonth && (income > 0 || expenses > 0)) {
      counts.budgetMonths += 1;
      const enteredAt = steps.find((s) => s.stepNumber === 3)?.updatedAt ?? steps.find((s) => s.stepNumber === 2)?.updatedAt ?? new Date();
      const surplus = income - expenses;
      if (apply) {
        await db.insert(clientBudgetMonthsTable).values({
          userId,
          month: `${enteredAt.toISOString().slice(0, 7)}-01`,
          primaryIncome: String(income),
          housing: String(expenseFields.housing),
          foodDining: String(expenseFields.foodDining),
          transport: String(expenseFields.transport),
          utilities: String(expenseFields.utilities),
          entertainment: String(expenseFields.entertainment),
          otherExpenses: String(expenseFields.otherExpenses),
          totalIncome: String(income),
          totalExpenses: String(expenses),
          netSurplus: String(surplus),
          savingsRatePct: String(income > 0 ? (surplus / income) * 100 : 0),
        }).onConflictDoNothing();
      }
    }

    // Step 4: the goal.
    const s4 = step(4);
    const [anyGoal] = await db.select({ id: financialGoalsTable.id }).from(financialGoalsTable)
      .where(eq(financialGoalsTable.userId, userId)).limit(1);
    if (!anyGoal && typeof s4.goalTitle === "string" && s4.goalTitle.trim()) {
      counts.goals += 1;
      const month = typeof s4.goalMonth === "string" ? MONTHS[s4.goalMonth] : undefined;
      if (apply) {
        await db.insert(financialGoalsTable).values({
          userId,
          title: s4.goalTitle.trim(),
          goalType: typeof s4.goalType === "string" ? s4.goalType : "other",
          targetAmount: num(s4.goalTarget) > 0 ? String(num(s4.goalTarget)) : null,
          targetDate: s4.goalYear && month ? `${s4.goalYear}-${month}-01` : null,
        });
      }
    }

    // Step 5: net worth, as entries the net worth screen shows.
    const s5 = step(5);
    const [anyAsset] = await db.select({ id: assetsTable.id }).from(assetsTable).where(eq(assetsTable.userId, userId)).limit(1);
    if (!anyAsset) {
      const entries = [
        { name: "Savings", category: "cash", value: num(s5.savings) },
        { name: "Investments", category: "investment", value: num(s5.investments) },
      ].filter((e) => e.value > 0);
      counts.assets += entries.length;
      if (apply && entries.length) {
        await db.insert(assetsTable).values(entries.map((e) => ({
          userId, name: e.name, category: e.category, valueUsd: String(e.value), valueOriginal: String(e.value),
        })));
      }
    }
    const [anyLiability] = await db.select({ id: liabilitiesTable.id }).from(liabilitiesTable).where(eq(liabilitiesTable.userId, userId)).limit(1);
    if (!anyLiability && num(s5.debts) > 0) {
      counts.liabilities += 1;
      if (apply) {
        await db.insert(liabilitiesTable).values({
          userId, name: "Debts", category: "other", balanceUsd: String(num(s5.debts)), balanceOriginal: String(num(s5.debts)),
        });
      }
    }

    // Step 6: risk profile.
    const riskProfile = normalizeRiskProfile(step(6).riskProfile);
    if (riskProfile) {
      const [cp] = await db.select({ riskProfile: clientProfilesTable.riskProfile }).from(clientProfilesTable)
        .where(eq(clientProfilesTable.userId, userId));
      if (!cp?.riskProfile) {
        counts.riskProfiles += 1;
        if (apply) {
          await db.insert(clientProfilesTable).values({ userId, riskProfile, riskProfileSource: "self" })
            .onConflictDoUpdate({ target: clientProfilesTable.userId, set: { riskProfile, riskProfileSource: "self" }, where: and(sql`${clientProfilesTable.riskProfile} is null`) });
        }
      }
    }
  }
  console.log(`Pathway migration ${apply ? "apply" : "dry run"}: ${JSON.stringify(counts)}`);
} finally {
  await pool.end();
}
