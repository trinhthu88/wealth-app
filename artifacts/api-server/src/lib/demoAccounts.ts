import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import {
  db, profilesTable, clientProfilesTable, financialGoalsTable, clientHoldingsTable, clientBudgetMonthsTable,
  assetsTable, liabilitiesTable, netWorthSnapshotsTable, advisedPlansTable, advisedPlanStatementsTable,
  advisedPlanHoldingsTable, advisorTasksTable, conversationsTable, messagesTable,
} from "@workspace/db";
import { setCompedMembership } from "./membershipStore";
import { runCheckpointHook } from "./checkpointEngine";
import { logger } from "./logger";

/**
 * One set of demo logins for showing the app to colleagues on the live site: a free user, a
 * Track B client, a Track A client and the advisor they share. Users are created through the
 * deployment's own Clerk instance, so they sign in on the live URL. Off unless
 * DEMO_ACCOUNTS_ENABLED=true and DEMO_ACCOUNTS_EMAIL names a real mailbox; the four logins are
 * plus-addresses of it, so any email code Clerk sends reaches that inbox.
 */
export const DEMO_ACCOUNTS = [
  { key: "advisor", tag: "advisor", role: "advisor", label: "Advisor", firstName: "Minh", lastName: "Tran" },
  { key: "free", tag: "free", role: "free_user", label: "Free plan", firstName: "Sofia", lastName: "Chen" },
  { key: "trackB", tag: "trackb", role: "investment_client", label: "Client, self-managed (Track B)", firstName: "James", lastName: "Whitfield" },
  { key: "trackA", tag: "tracka", role: "investment_client", label: "Client, advised (Track A)", firstName: "Elena", lastName: "Novak" },
] as const;
export type DemoKey = (typeof DEMO_ACCOUNTS)[number]["key"];

const EMAIL = /^[^\s@+]+@[^\s@]+\.[^\s@]+$/;

function baseEmail(): string | null {
  const value = process.env.DEMO_ACCOUNTS_EMAIL?.trim().toLowerCase() ?? "";
  return EMAIL.test(value) ? value : null;
}

export function demoAccountsEnabled(): boolean {
  return process.env.DEMO_ACCOUNTS_ENABLED === "true" && baseEmail() !== null;
}

export function demoEmail(tag: string): string {
  const [local, domain] = baseEmail()!.split("@");
  return `${local}+tala-demo-${tag}@${domain}`;
}

export interface DemoAccountResult {
  key: DemoKey;
  label: string;
  role: string;
  fullName: string;
  email: string;
  /** Shown once to the super admin who ran this; never stored or logged. Null when Clerk only allows email codes. */
  password: string | null;
  created: boolean;
}

function newPassword(): string {
  return `${randomBytes(12).toString("base64url")}Aa1!`;
}

function isPasswordRejection(err: unknown): boolean {
  const errors = (err as { errors?: Array<{ code?: string; message?: string }> })?.errors ?? [];
  return errors.some((e) => /password/i.test(`${e.code ?? ""} ${e.message ?? ""}`));
}

/** Finds or creates the Clerk user and sets a fresh password. Falls back to email codes when passwords are off. */
async function upsertClerkUser(email: string, firstName: string, lastName: string): Promise<{ id: string; password: string | null }> {
  const found = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
  const existing = found.data[0];
  const password = newPassword();
  if (existing) {
    try {
      await clerkClient.users.updateUser(existing.id, { password, skipPasswordChecks: true });
      return { id: existing.id, password };
    } catch (err) {
      if (isPasswordRejection(err)) return { id: existing.id, password: null };
      throw err;
    }
  }
  try {
    const user = await clerkClient.users.createUser({ emailAddress: [email], firstName, lastName, password, skipPasswordChecks: true });
    return { id: user.id, password };
  } catch (err) {
    if (!isPasswordRejection(err)) throw err;
    const user = await clerkClient.users.createUser({ emailAddress: [email], firstName, lastName });
    return { id: user.id, password: null };
  }
}

/** First day of the month n months before now, as YYYY-MM-01. */
function monthsAgo(n: number, now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString().slice(0, 10);
}
function daysAgo(n: number, now: Date): string {
  return new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);
}
function yearsAhead(n: number, now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear() + n, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** A budget month whose totals match its lines, as the client budget route would store them. */
function budgetMonth(userId: string, month: string, income: Record<string, number>, expenses: Record<string, number>, contributions: Array<{ source_type: string; source_id: string; amount: number; label: string }> = []) {
  const totalIncome = Object.values(income).reduce((s, v) => s + v, 0);
  const totalExpenses = Object.values(expenses).reduce((s, v) => s + v, 0);
  const totalInvestments = contributions.reduce((s, c) => s + c.amount, 0);
  const netSurplus = totalIncome - totalExpenses - totalInvestments;
  const str = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]));
  return {
    userId, month, currency: "USD", ...str(income), ...str(expenses),
    investmentContributions: contributions,
    totalIncome: String(totalIncome), totalExpenses: String(totalExpenses), totalInvestments: String(totalInvestments),
    netSurplus: String(netSurplus),
    savingsRatePct: String(totalIncome > 0 ? Math.round(((netSurplus + totalInvestments) / totalIncome) * 1000) / 10 : 0),
  };
}

async function seedFree(userId: string, now: Date) {
  await db.insert(clientProfilesTable).values({ userId, onboardingStage: "complete", onboardingTrackComplete: true, riskProfile: "balanced" })
    .onConflictDoNothing();
  // One goal: the free plan's cap, so a second "Add goal" shows the upgrade checkpoint.
  await db.insert(financialGoalsTable).values({
    userId, title: "Emergency fund", goalType: "emergency_fund", targetAmount: "20000", currentAmount: "14200",
    monthlyContribution: "500", targetDate: yearsAhead(1, now), priority: "high", status: "active",
  });
  await db.insert(clientHoldingsTable).values([
    { userId, holdingType: "cash", label: "Savings account", currency: "USD", bankName: "Techcombank", accountType: "savings", currentBalance: "12000", interestRatePct: "4.5" },
    { userId, holdingType: "stock_etf", label: "Global index ETF", currency: "USD", ticker: "VT", brokerPlatform: "Interactive Brokers", unitsHeld: "80", averageCostPrice: "102.50", purchaseDate: daysAgo(400, now) },
    { userId, holdingType: "pension", label: "Company pension", currency: "USD", schemeName: "Employer scheme", currentBalancePension: "22000", monthlyContribution: "300" },
  ]);
  const income = { primaryIncome: 6200 };
  for (const [n, extra] of [[2, 0], [1, 120], [0, 60]] as const) {
    await db.insert(clientBudgetMonthsTable).values(budgetMonth(userId, monthsAgo(n, now), income,
      { housing: 1800, utilities: 220, transport: 300, foodDining: 640 + extra, entertainment: 250, otherExpenses: 180 }));
  }
  await db.insert(assetsTable).values({ userId, name: "Car", category: "vehicle", valueUsd: "8000" });
  await db.insert(liabilitiesTable).values([
    { userId, name: "Student loan", category: "student_loan", balanceUsd: "6500", interestRatePercent: "4.5", monthlyPaymentUsd: "180" },
    { userId, name: "Credit card", category: "credit_card", balanceUsd: "1000", interestRatePercent: "19.9", monthlyPaymentUsd: "100" },
  ]);
  await db.insert(netWorthSnapshotsTable).values([
    { userId, snapshotDate: daysAgo(60, now), totalAssetsUsd: "46000", totalLiabilitiesUsd: "8000", netWorthUsd: "38000", createdBy: "demo" },
    { userId, snapshotDate: daysAgo(30, now), totalAssetsUsd: "48500", totalLiabilitiesUsd: "7700", netWorthUsd: "40800", createdBy: "demo" },
    { userId, snapshotDate: daysAgo(1, now), totalAssetsUsd: "51200", totalLiabilitiesUsd: "7500", netWorthUsd: "43700", createdBy: "demo" },
  ]);
}

async function seedClientProfile(userId: string, advisorId: string, riskProfile: string, since: string) {
  await db.insert(clientProfilesTable).values({
    userId, advisorId, status: "active", kycStatus: "verified", riskProfile, onboardingStep: 6,
    prospectOnboardingComplete: true, fullOnboardingComplete: true, relationshipStartDate: since,
    onboardingTrackComplete: true, onboardingStage: "complete",
  }).onConflictDoUpdate({ target: clientProfilesTable.userId, set: { advisorId, status: "active" } });
}

async function seedTrackB(userId: string, advisorId: string, now: Date) {
  await seedClientProfile(userId, advisorId, "balanced", daysAgo(365, now));
  await db.insert(clientHoldingsTable).values([
    { userId, holdingType: "stock_etf", label: "US total market ETF", currency: "USD", ticker: "VTI", brokerPlatform: "Charles Schwab", unitsHeld: "220", averageCostPrice: "195.40", purchaseDate: daysAgo(900, now) },
    { userId, holdingType: "crypto", label: "Bitcoin", currency: "USD", coinSymbol: "BTC", exchangeName: "Coinbase", unitsHeld: "0.85", averageCostPrice: "38200", purchaseDate: daysAgo(1100, now) },
    { userId, holdingType: "property", label: "Rental apartment, District 2", currency: "USD", propertyAddress: "Thao Dien, Thu Duc City", country: "VN", purchasePrice: "310000", currentEstimatedValue: "365000", outstandingMortgage: "210000", monthlyRentalIncome: "2100", purchaseDate: daysAgo(1400, now) },
    { userId, holdingType: "cash", label: "High-yield savings", currency: "USD", bankName: "HSBC", accountType: "savings", currentBalance: "38000", interestRatePct: "4.25" },
  ]);
  await db.insert(financialGoalsTable).values([
    { userId, title: "Financial independence by 55", goalType: "financial_independence", targetAmount: "1500000", currentAmount: "142000", monthlyContribution: "2000", targetDate: yearsAhead(15, now), priority: "high", status: "active" },
    { userId, title: "Kids' university fund", goalType: "education", targetAmount: "120000", currentAmount: "18000", monthlyContribution: "400", targetDate: yearsAhead(8, now), priority: "medium", status: "active" },
  ]);
  for (const n of [2, 1, 0]) {
    await db.insert(clientBudgetMonthsTable).values(budgetMonth(userId, monthsAgo(n, now), { primaryIncome: 14000, rentalIncome: 2100 },
      { housing: 3200, utilities: 380, transport: 600, insurance: 500, foodDining: 1100, entertainment: 600, shopping: 700, health: 300, education: 400, otherExpenses: 250 }));
  }
}

async function seedTrackA(userId: string, advisorId: string, now: Date) {
  await seedClientProfile(userId, advisorId, "growth", daysAgo(600, now));
  const [plan] = await db.insert(advisedPlansTable).values({
    userId, advisorId, providerName: "Friends Provident International", productCode: "RSP-GROWTH-25",
    productName: "Reserve Savings Plan", policyNumber: "FPI-88213", planType: "rsp", currency: "USD", termYears: 25,
    annualPremium: "14400", initialPremium: "5000", effectiveDate: daysAgo(600, now), maturityDate: yearsAhead(23, now),
    status: "inforce", latestAccountValue: "38740", latestNetContribution: "31200", latestStatementDate: daysAgo(40, now),
    nickname: "Global Growth Plan", isVisibleToClient: true,
  }).returning();
  const statement = (periodStart: string, periodEnd: string, opening: string, closing: string, returns: string) => ({
    advisedPlanId: plan.id, userId, periodStart, periodEnd, statementDate: periodEnd,
    openingValue: opening, closingValue: closing, contributions: "3600", extraAllocations: "0", investmentReturns: returns,
    policyFee: "60", assetManagementFee: "90", adminCharges: "20", advisoryServicesFee: "40", bidOfferSpread: "30",
    surrenders: "0", surrenderCharges: "0", enteredBy: advisorId, entryMode: "summary",
  });
  await db.insert(advisedPlanStatementsTable).values(statement(daysAgo(220, now), daysAgo(131, now), "30800", "35560", "1400"));
  const [latest] = await db.insert(advisedPlanStatementsTable).values(statement(daysAgo(130, now), daysAgo(40, now), "35560", "38740", "-180")).returning();
  await db.insert(advisedPlanHoldingsTable).values([
    { statementId: latest.id, advisedPlanId: plan.id, userId, fundCode: "GEQ-100", fundName: "Global Equity Growth Fund", unitValueDate: daysAgo(40, now), unitValue: "18.42", unitsHeld: "1350.20", holdingValue: "24870", finalValue: "24870", futureAllocationPct: "65" },
    { statementId: latest.id, advisedPlanId: plan.id, userId, fundCode: "GBD-050", fundName: "Global Balanced Bond Fund", unitValueDate: daysAgo(40, now), unitValue: "11.05", unitsHeld: "1255.75", holdingValue: "13870", finalValue: "13870", futureAllocationPct: "35" },
  ]);
  await db.insert(financialGoalsTable).values({
    userId, title: "Retirement at 60", goalType: "retirement", targetAmount: "800000", currentAmount: "185000",
    monthlyContribution: "1200", targetDate: yearsAhead(23, now), priority: "high", status: "active", isAdvisorManaged: true,
  });
  const contribution = [{ source_type: "advised_plan", source_id: plan.id, amount: 1200, label: "Global Growth Plan" }];
  for (const n of [2, 1, 0]) {
    await db.insert(clientBudgetMonthsTable).values(budgetMonth(userId, monthsAgo(n, now), { primaryIncome: 9500 },
      { housing: 2400, utilities: 300, transport: 450, insurance: 350, foodDining: 800, entertainment: 400, shopping: 500, health: 200, otherExpenses: 150 }, contribution));
  }
  const [conversation] = await db.insert(conversationsTable).values({ clientId: userId, advisorId }).returning();
  await db.insert(messagesTable).values([
    { conversationId: conversation.id, senderId: advisorId, senderRole: "advisor", content: "Hi Elena, your latest statement is in. The plan is on track; let's review the bond allocation at our next meeting.", sentAt: new Date(now.getTime() - 3 * 86_400_000) },
    { conversationId: conversation.id, senderId: userId, senderRole: "client", content: "Thanks Minh, next Tuesday works for me.", sentAt: new Date(now.getTime() - 2 * 86_400_000) },
  ]);
}

/**
 * Creates the four demo users, or, when they exist, gives each a fresh password and leaves their
 * data as it is. Idempotent: running it again never duplicates rows.
 */
export async function createDemoAccounts(now: Date = new Date()): Promise<DemoAccountResult[]> {
  const results: DemoAccountResult[] = [];
  const ids: Partial<Record<DemoKey, string>> = {};

  for (const account of DEMO_ACCOUNTS) {
    const email = demoEmail(account.tag);
    const fullName = `${account.firstName} ${account.lastName}`;
    const { id, password } = await upsertClerkUser(email, account.firstName, account.lastName);
    ids[account.key] = id;

    const [existing] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.id, id));
    if (!existing) {
      // Backdated so the client wealth score is past its three-month gate on day one of the demo.
      await db.insert(profilesTable).values({
        id, email, fullName, role: account.role, onboardingComplete: true, createdAt: new Date(now.getTime() - 200 * 86_400_000),
      });
    }
    results.push({ key: account.key, label: account.label, role: account.role, fullName, email, password, created: !existing });
  }

  const advisorId = ids.advisor!;
  const created = new Set(results.filter((r) => r.created).map((r) => r.key));
  if (created.has("free")) await seedFree(ids.free!, now);
  if (created.has("trackB")) await seedTrackB(ids.trackB!, advisorId, now);
  if (created.has("trackA")) await seedTrackA(ids.trackA!, advisorId, now);
  for (const key of ["trackB", "trackA"] as const) {
    if (!created.has(key)) continue;
    const outcome = await setCompedMembership(ids[key]!, "comp", "Demo account");
    if (!outcome.ok) throw new Error(`Could not comp the ${key} demo membership: ${outcome.error}`);
  }
  if (created.has("trackA") || created.has("trackB")) {
    await db.insert(advisorTasksTable).values([
      ...(created.has("trackA") ? [{ advisorId, clientId: ids.trackA!, title: "Quarterly review with Elena Novak", description: "Go through the latest statement and the bond allocation.", dueDate: daysAgo(-7, now), priority: "high", status: "todo" }] : []),
      ...(created.has("trackB") ? [{ advisorId, clientId: ids.trackB!, title: "Discuss an advised plan with James Whitfield", description: "Large monthly surplus; show the Track A comparison.", dueDate: daysAgo(-14, now), priority: "medium", status: "todo" }] : []),
    ]);
  }
  if (created.has("free")) {
    try { await runCheckpointHook(ids.free!); } catch (err) { logger.warn({ err }, "Demo free user checkpoint hook failed"); }
  }
  return results;
}
