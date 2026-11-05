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
 * Demo logins for showing the app to colleagues on the live site. Users are created (or picked up,
 * if they already signed up) through the deployment's own Clerk instance, so they sign in on the
 * live URL, and each empty account gets sample data for its kind.
 *
 * Which accounts: DEMO_ACCOUNTS lists them as `kind:email[:Full Name]`, comma separated, with
 * kind one of advisor, free, trackA, trackB and exactly one advisor, for example
 *   advisor:owner@company.com, free:contact@company.com, trackA:elena@demo.example:Elena Novak
 * Without DEMO_ACCOUNTS, DEMO_ACCOUNTS_EMAIL gives the default four as plus-addresses of one inbox.
 * Off unless DEMO_ACCOUNTS_ENABLED=true and one of the two is valid.
 *
 * A super admin listed here keeps their role and password: they are the owner's own login and act
 * as the advisor of record when listed as the advisor.
 */
export const DEMO_KINDS = ["advisor", "free", "trackA", "trackB"] as const;
export type DemoKind = (typeof DEMO_KINDS)[number];

const ROLE: Record<DemoKind, string> = { advisor: "advisor", free: "free_user", trackA: "investment_client", trackB: "investment_client" };
const LABEL: Record<DemoKind, string> = {
  advisor: "Advisor", free: "Free plan", trackB: "Client, self-managed (Track B)", trackA: "Client, advised (Track A)",
};
const PERSONA: Record<DemoKind, [string, string]> = {
  advisor: ["Minh", "Tran"], free: ["Sofia", "Chen"], trackB: ["James", "Whitfield"], trackA: ["Elena", "Novak"],
};

export interface DemoSlot {
  key: string;
  kind: DemoKind;
  role: string;
  label: string;
  email: string;
  firstName: string;
  lastName: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseEmail(): string | null {
  const value = process.env.DEMO_ACCOUNTS_EMAIL?.trim().toLowerCase() ?? "";
  return EMAIL.test(value) && !value.includes("+") ? value : null;
}

function slot(kind: DemoKind, email: string, index: number, name?: string): DemoSlot {
  const [first, ...rest] = (name?.trim() || PERSONA[kind].join(" ")).split(/\s+/);
  return {
    key: `${kind}-${index}`, kind, role: ROLE[kind], label: LABEL[kind], email,
    firstName: first, lastName: rest.join(" "),
  };
}

/** The configured accounts, or an error saying what is wrong with the configuration. */
export function demoSlots(): { slots: DemoSlot[] } | { error: string } {
  const list = process.env.DEMO_ACCOUNTS?.trim();
  if (list) {
    const slots: DemoSlot[] = [];
    const seen = new Set<string>();
    for (const [index, raw] of list.split(",").map((s) => s.trim()).filter(Boolean).entries()) {
      const [kind, email, ...name] = raw.split(":").map((s) => s.trim());
      if (!DEMO_KINDS.includes(kind as DemoKind)) return { error: `Unknown kind "${kind}" in DEMO_ACCOUNTS; use advisor, free, trackA or trackB.` };
      const address = (email ?? "").toLowerCase();
      if (!EMAIL.test(address)) return { error: `"${email ?? ""}" in DEMO_ACCOUNTS is not an email address.` };
      if (seen.has(address)) return { error: `${address} is listed twice in DEMO_ACCOUNTS.` };
      seen.add(address);
      slots.push(slot(kind as DemoKind, address, index, name.join(":")));
    }
    const advisors = slots.filter((s) => s.kind === "advisor").length;
    if (advisors !== 1) return { error: `DEMO_ACCOUNTS needs exactly one advisor; it has ${advisors}.` };
    return { slots };
  }
  const base = baseEmail();
  if (!base) return { error: "Set DEMO_ACCOUNTS, or DEMO_ACCOUNTS_EMAIL to one inbox." };
  const [local, domain] = base.split("@");
  return {
    slots: (["advisor", "free", "trackB", "trackA"] as const).map((kind, i) =>
      slot(kind, `${local}+tala-demo-${kind.toLowerCase()}@${domain}`, i)),
  };
}

export function demoAccountsEnabled(): boolean {
  return process.env.DEMO_ACCOUNTS_ENABLED === "true" && "slots" in demoSlots();
}

export interface DemoAccountResult {
  key: string;
  kind: DemoKind;
  label: string;
  role: string;
  fullName: string;
  email: string;
  /** Shown once to the super admin who ran this; never stored or logged. Null when not set (see passwordNote). */
  password: string | null;
  /** Why there is no password: the owner's own super-admin login, or a Clerk instance with passwords off. */
  passwordNote: "own_login" | "email_code" | null;
  created: boolean;
  /** Whether sample data was added this time; an account that already has data keeps it. */
  seeded: boolean;
}

function newPassword(): string {
  return `${randomBytes(12).toString("base64url")}Aa1!`;
}

function isPasswordRejection(err: unknown): boolean {
  const errors = (err as { errors?: Array<{ code?: string; message?: string }> })?.errors ?? [];
  return errors.some((e) => /password/i.test(`${e.code ?? ""} ${e.message ?? ""}`));
}

type ClerkOutcome = { id: string; created: boolean; password: string | null; passwordNote: DemoAccountResult["passwordNote"] };

/**
 * Finds or creates the Clerk user. Sets a fresh password unless keepPassword (the owner's own
 * login). Falls back to email codes when the instance has passwords off.
 */
async function upsertClerkUser(email: string, firstName: string, lastName: string, keepPassword: (clerkId: string) => Promise<boolean>): Promise<ClerkOutcome> {
  const found = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
  const existing = found.data[0];
  const password = newPassword();
  if (existing) {
    if (await keepPassword(existing.id)) return { id: existing.id, created: false, password: null, passwordNote: "own_login" };
    try {
      await clerkClient.users.updateUser(existing.id, { password, skipPasswordChecks: true });
      return { id: existing.id, created: false, password, passwordNote: null };
    } catch (err) {
      if (isPasswordRejection(err)) return { id: existing.id, created: false, password: null, passwordNote: "email_code" };
      throw err;
    }
  }
  try {
    const user = await clerkClient.users.createUser({ emailAddress: [email], firstName, lastName, password, skipPasswordChecks: true });
    return { id: user.id, created: true, password, passwordNote: null };
  } catch (err) {
    if (!isPasswordRejection(err)) throw err;
    const user = await clerkClient.users.createUser({ emailAddress: [email], firstName, lastName });
    return { id: user.id, created: true, password: null, passwordNote: "email_code" };
  }
}

/** Whether the account has anything a demo seed would otherwise duplicate. */
async function hasData(userId: string): Promise<boolean> {
  const [[goal], [holding], [month], [plan]] = await Promise.all([
    db.select({ id: financialGoalsTable.id }).from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId)).limit(1),
    db.select({ id: clientHoldingsTable.id }).from(clientHoldingsTable).where(eq(clientHoldingsTable.userId, userId)).limit(1),
    db.select({ id: clientBudgetMonthsTable.id }).from(clientBudgetMonthsTable).where(eq(clientBudgetMonthsTable.userId, userId)).limit(1),
    db.select({ id: advisedPlansTable.id }).from(advisedPlansTable).where(eq(advisedPlansTable.userId, userId)).limit(1),
  ]);
  return !!(goal || holding || month || plan);
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

async function seedTrackA(userId: string, advisorId: string, now: Date, names: { client: string; advisor: string; policy: number }) {
  await seedClientProfile(userId, advisorId, "growth", daysAgo(600, now));
  const [plan] = await db.insert(advisedPlansTable).values({
    userId, advisorId, providerName: "Friends Provident International", productCode: "RSP-GROWTH-25",
    productName: "Reserve Savings Plan", policyNumber: `FPI-${88213 + names.policy}`, planType: "rsp", currency: "USD", termYears: 25,
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
    { conversationId: conversation.id, senderId: advisorId, senderRole: "advisor", content: `Hi ${names.client}, your latest statement is in. The plan is on track; let's review the bond allocation at our next meeting.`, sentAt: new Date(now.getTime() - 3 * 86_400_000) },
    { conversationId: conversation.id, senderId: userId, senderRole: "client", content: `Thanks ${names.advisor}, next Tuesday works for me.`, sentAt: new Date(now.getTime() - 2 * 86_400_000) },
  ]);
}

/**
 * Creates the configured demo users, or picks them up when they exist: an empty account gets
 * sample data for its kind, an account with data keeps it. Clients are linked to the advisor and
 * comped. Each login except the owner's own super-admin login gets a fresh password. Idempotent:
 * running it again never duplicates rows.
 */
export async function createDemoAccounts(now: Date = new Date()): Promise<DemoAccountResult[]> {
  const config = demoSlots();
  if ("error" in config) throw new Error(config.error);
  const { slots } = config;

  const accounts: Array<{ slot: DemoSlot; id: string; result: DemoAccountResult; seed: boolean }> = [];
  for (const s of slots) {
    const isSuperAdmin = async (clerkId: string) => {
      const [p] = await db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, clerkId));
      return p?.role === "super_admin";
    };
    const clerk = await upsertClerkUser(s.email, s.firstName, s.lastName, isSuperAdmin);
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, clerk.id));
    let role = s.role;
    let fullName = `${s.firstName} ${s.lastName}`.trim();
    if (!profile) {
      // Backdated so the client wealth score is past its three-month gate on day one of the demo.
      await db.insert(profilesTable).values({
        id: clerk.id, email: s.email, fullName, role, onboardingComplete: true, createdAt: new Date(now.getTime() - 200 * 86_400_000),
      });
    } else {
      fullName = profile.fullName ?? fullName;
      // Never demote the owner. Anyone else takes the role their slot names.
      if (profile.role === "super_admin") role = "super_admin";
      else if (profile.role !== role) await db.update(profilesTable).set({ role, updatedAt: new Date() }).where(eq(profilesTable.id, clerk.id));
    }
    const seed = s.kind !== "advisor" && !(await hasData(clerk.id));
    accounts.push({
      slot: s, id: clerk.id, seed,
      result: {
        key: s.key, kind: s.kind, label: s.label, role, fullName, email: s.email,
        password: clerk.password, passwordNote: clerk.passwordNote, created: clerk.created, seeded: seed,
      },
    });
  }

  const advisor = accounts.find((a) => a.slot.kind === "advisor")!;
  const advisorFirst = advisor.result.fullName.split(/\s+/)[0] || "your advisor";
  let trackAIndex = 0;
  for (const a of accounts) {
    const clientFirst = a.result.fullName.split(/\s+/)[0] || "there";
    if (a.slot.kind === "free" && a.seed) {
      await seedFree(a.id, now);
      try { await runCheckpointHook(a.id); } catch (err) { logger.warn({ err }, "Demo free user checkpoint hook failed"); }
    }
    if (a.slot.kind === "trackB" || a.slot.kind === "trackA") {
      if (a.seed && a.slot.kind === "trackB") await seedTrackB(a.id, advisor.id, now);
      if (a.seed && a.slot.kind === "trackA") await seedTrackA(a.id, advisor.id, now, { client: clientFirst, advisor: advisorFirst, policy: trackAIndex });
      if (a.slot.kind === "trackA") trackAIndex++;
      // Linked to the advisor and comped whether or not the account was seeded now.
      await db.update(clientProfilesTable).set({ advisorId: advisor.id, updatedAt: new Date() }).where(eq(clientProfilesTable.userId, a.id));
      if (!a.seed) {
        await db.insert(clientProfilesTable).values({ userId: a.id, advisorId: advisor.id, status: "active", onboardingTrackComplete: true, onboardingStage: "complete" })
          .onConflictDoNothing();
      }
      const outcome = await setCompedMembership(a.id, "comp", "Demo account");
      if (!outcome.ok && outcome.httpStatus !== 409) throw new Error(`Could not comp ${a.slot.email}: ${outcome.error}`);
      if (a.seed) {
        await db.insert(advisorTasksTable).values(a.slot.kind === "trackA"
          ? { advisorId: advisor.id, clientId: a.id, title: `Quarterly review with ${a.result.fullName}`, description: "Go through the latest statement and the bond allocation.", dueDate: daysAgo(-7, now), priority: "high", status: "todo" }
          : { advisorId: advisor.id, clientId: a.id, title: `Discuss an advised plan with ${a.result.fullName}`, description: "Large monthly surplus; show the Track A comparison.", dueDate: daysAgo(-14, now), priority: "medium", status: "todo" });
      }
    }
  }
  return accounts.map((a) => a.result);
}
