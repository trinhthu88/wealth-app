/**
 * Builds the demo accounts on the live site through the app's own API, signed in as each person in
 * turn, so every row passes the same validation, tier limits and side effects as the real screens:
 * a free account cannot get a second goal, a membership comes from the super admin's comp, an
 * advisor relationship comes from assigning the client's lead, and a plan goes in force the way an
 * advisor does it. Computed values (goal funding, budget totals, net worth) are left to the app.
 *
 * Runs inside the deployment (it needs the live database and sign-in service), from
 * scripts/run-production-tasks.mjs. Without --apply it only checks the accounts and lists what it
 * would add. Each person must have signed in on the live site once. Anyone holding data of their own
 * (anything that isn't their demo persona's) is skipped, so nothing is mixed into real data. Every step
 * carries on from what an interrupted run left, so running it again finishes the job.
 *
 *   DEMO_ACCOUNTS="advisor=a@x.com, free=b@x.com, track_a=c@x.com, track_a=d@x.com, track_b=e@x.com"
 *   The super admin is SUPER_ADMIN_EMAIL. The first track_a uses persona 1, the second persona 2.
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, pool, profilesTable, financialGoalsTable, clientHoldingsTable, clientBudgetMonthsTable,
  advisedPlansTable, leadsTable, membershipsTable, clientProfilesTable, liabilitiesTable,
  advisedPlanStatementsTable, financialPlansTable, planMilestonesTable, messagesTable, goalHoldingLinksTable,
} from "@workspace/db";
import { computeNetWorth } from "../lib/netWorthService";
import { isRowActive } from "../lib/membershipStore";

type Role = "advisor" | "free" | "track_a" | "track_b";
interface Account {
  role: Role; email: string; id?: string; currentRole?: string; fullName?: string | null;
  isMember?: boolean; advisorId?: string | null;
}

const MONTH = (offset: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)).toISOString().slice(0, 10);
};
const months = (count: number) => Array.from({ length: count }, (_, i) => MONTH(count - 1 - i));

// ── Personas. Amounts in USD. Holdings list cash first: the budget's surplus goes to it. ──────────

interface Holding { key: string; body: Record<string, unknown> }
interface Goal { body: Record<string, unknown>; links: Array<{ holding?: string; plan?: true; pct: number }> }
interface Budget {
  income: Record<string, number>; expenses: Record<string, number>;
  contributions: Array<{ holding: string; amount: number }>;
}
interface Persona {
  name: string; dob: string; countryCode: string; isExpat: boolean; firstFocus: string; risk: string;
  holdings: Holding[]; liabilities: Array<Record<string, unknown>>; goals: Goal[]; budget: Budget; budgetMonths: number;
  plan?: {
    body: Record<string, unknown>; policyNumber: string;
    statements: Array<{ periodStart: string; periodEnd: string; contributions: number; fees: Record<string, number>; returns: number }>;
    funds: Array<{ fundCode: string; fundName: string; share: number; futureAllocationPct: number }>;
    proposal?: Record<string, unknown>;
    financialPlan: { title: string; milestones: Array<{ title: string; targetDate: string; status?: string }> };
    messages: Array<{ from: "advisor" | "client"; content: string }>;
  };
}

const vary = (base: Record<string, number>, i: number) =>
  Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round(v * (1 + (((i * 7 + k.length) % 5) - 2) / 50))]));

const FREE: Persona = {
  name: "Minh Anh", dob: "1997-04", countryCode: "VN", isExpat: false, firstFocus: "know_my_money", risk: "balanced",
  // Three holdings: the free plan tracks five.
  holdings: [
    { key: "cash", body: { holdingType: "cash", label: "Techcombank savings", bankName: "Techcombank", accountType: "savings", currentBalance: 4200, interestRatePct: 4.5 } },
    { key: "voo", body: { holdingType: "stock_etf", label: "Vanguard S&P 500 ETF", ticker: "VOO", brokerPlatform: "Interactive Brokers", unitsHeld: 6, averageCostPrice: 480, purchaseDate: "2025-09-15" } },
    { key: "gold", body: { holdingType: "other", label: "Gold (SJC)", currentValueOther: 1800, totalInvestedOther: 1500 } },
  ],
  liabilities: [{ name: "Techcombank Visa", category: "credit_card", balanceUsd: 650, interestRatePercent: 28, monthlyPaymentUsd: 120 }],
  // One goal: the free plan's limit.
  goals: [{
    body: { title: "Emergency fund", goalType: "emergency", targetAmount: 6000, monthlyContribution: 300, targetDate: "2027-06-30", priority: "high" },
    links: [{ holding: "cash", pct: 100 }],
  }],
  budgetMonths: 4, // the free plan reads the current month and the three before it
  budget: {
    income: { primaryIncome: 1800 },
    expenses: { housing: 450, utilities: 60, transport: 70, insurance: 30, foodDining: 300, entertainment: 90, shopping: 110, health: 40 },
    contributions: [{ holding: "voo", amount: 150 }],
  },
};

const TRACK_B: Persona = {
  name: "James Whitfield", dob: "1985-09", countryCode: "VN", isExpat: true, firstFocus: "start_investing", risk: "growth",
  holdings: [
    { key: "cash", body: { holdingType: "cash", label: "HSBC current account", bankName: "HSBC", accountType: "current", currentBalance: 12000, interestRatePct: 0.5 } },
    { key: "vt", body: { holdingType: "stock_etf", label: "Vanguard Total World ETF", ticker: "VT", brokerPlatform: "Interactive Brokers", unitsHeld: 120, averageCostPrice: 105, purchaseDate: "2024-02-01" } },
    { key: "btc", body: { holdingType: "crypto", label: "Bitcoin", coinSymbol: "BTC", exchangeName: "Binance", unitsHeld: 0.15, averageCostPrice: 60000, purchaseDate: "2024-06-10" } },
    // The mortgage lives on the property; the app shows it as a liability from here.
    { key: "home", body: { holdingType: "property", label: "Apartment, Thao Dien", propertyAddress: "Thao Dien, Thu Duc, Ho Chi Minh City", country: "VN", purchasePrice: 260000, currentEstimatedValue: 310000, outstandingMortgage: 140000, purchaseDate: "2021-03-01" } },
    { key: "pension", body: { holdingType: "pension", label: "UK workplace pension", schemeName: "UK workplace pension", pensionCountry: "GB", currentBalancePension: 68000 } },
  ],
  liabilities: [{ name: "Car loan", category: "personal_loan", balanceUsd: 9500, interestRatePercent: 6.5, monthlyPaymentUsd: 420 }],
  goals: [
    { body: { title: "Retire at 55", goalType: "retire", targetAmount: 1200000, monthlyContribution: 1500, targetDate: "2040-09-30", priority: "high" },
      links: [{ holding: "pension", pct: 100 }, { holding: "vt", pct: 60 }] },
    { body: { title: "Family home in the UK", goalType: "property", targetAmount: 150000, monthlyContribution: 800, targetDate: "2030-06-30", priority: "medium" },
      links: [{ holding: "vt", pct: 40 }, { holding: "btc", pct: 100 }] },
    { body: { title: "Emergency fund", goalType: "emergency", targetAmount: 25000, monthlyContribution: 500, targetDate: "2027-12-31", priority: "high" },
      links: [{ holding: "cash", pct: 100 }] },
  ],
  budgetMonths: 7,
  budget: {
    income: { primaryIncome: 9500 },
    expenses: { housing: 1600, utilities: 180, transport: 250, insurance: 220, foodDining: 900, entertainment: 350, shopping: 400, health: 120, education: 1100, otherExpenses: 150 },
    contributions: [{ holding: "vt", amount: 1000 }, { holding: "btc", amount: 200 }],
  },
};

const PLAN_START = MONTH(6);
const quarter = (startOffset: number) => {
  const start = MONTH(startOffset);
  const end = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1 + 3, 0)).toISOString().slice(0, 10);
  return { periodStart: start, periodEnd: end };
};

const TRACK_A: Persona[] = [
  {
    name: "Thu Trang", dob: "1991-02", countryCode: "VN", isExpat: false, firstFocus: "save_for_big", risk: "balanced",
    holdings: [
      { key: "cash", body: { holdingType: "cash", label: "Techcombank savings", bankName: "Techcombank", accountType: "savings", currentBalance: 9000, interestRatePct: 4.7 } },
      { key: "vt", body: { holdingType: "stock_etf", label: "Vanguard Total World ETF", ticker: "VT", brokerPlatform: "Interactive Brokers", unitsHeld: 25, averageCostPrice: 104, purchaseDate: "2025-01-20" } },
      { key: "gold", body: { holdingType: "other", label: "Gold (SJC)", currentValueOther: 3500, totalInvestedOther: 2900 } },
    ],
    liabilities: [{ name: "VIB credit card", category: "credit_card", balanceUsd: 400, interestRatePercent: 26, monthlyPaymentUsd: 100 }],
    goals: [
      { body: { title: "Buy my home", goalType: "property", targetAmount: 120000, monthlyContribution: 800, targetDate: "2031-12-31", priority: "high" },
        links: [{ plan: true, pct: 100 }, { holding: "vt", pct: 100 }] },
      { body: { title: "Emergency fund", goalType: "emergency", targetAmount: 8000, monthlyContribution: 200, targetDate: "2027-06-30", priority: "medium" },
        links: [{ holding: "cash", pct: 100 }] },
    ],
    budgetMonths: 7,
    budget: {
      income: { primaryIncome: 3200, secondaryIncome: 400 },
      expenses: { housing: 650, utilities: 90, transport: 110, insurance: 60, foodDining: 450, entertainment: 150, shopping: 200, health: 60, otherExpenses: 80 },
      contributions: [{ holding: "vt", amount: 250 }],
    },
    plan: {
      body: { providerName: "Harbor Life International", productName: "Global Savings Plan", planType: "rsp", currency: "USD", termYears: 15, annualPremium: 9600, initialPremium: 0, effectiveDate: PLAN_START, nickname: "Home savings plan" },
      policyNumber: "HLI-DEMO-00219",
      statements: [
        { ...quarter(6), contributions: 2400, fees: { policyFee: 24, assetManagementFee: 9 }, returns: 45 },
        { ...quarter(3), contributions: 2400, fees: { policyFee: 24, assetManagementFee: 18 }, returns: 110 },
      ],
      funds: [
        { fundCode: "HLI-GEQ", fundName: "Global Equity Fund", share: 0.6, futureAllocationPct: 60 },
        { fundCode: "HLI-ABF", fundName: "Asia Pacific Bond Fund", share: 0.4, futureAllocationPct: 40 },
      ],
      financialPlan: { title: "Home purchase plan", milestones: [
        { title: "Emergency fund at three months of spending", targetDate: "2027-06-30" },
        { title: "Savings plan reaches 25,000", targetDate: "2028-12-31" },
        { title: "Deposit ready for the home", targetDate: "2031-06-30" },
      ] },
      messages: [
        { from: "advisor", content: "Hi, your savings plan is now in force. I've linked it to your home goal so you can see its progress there." },
        { from: "client", content: "Thank you! Can we look at increasing the monthly amount next year?" },
        { from: "advisor", content: "Of course. Let's review it at your annual review. I've added it to the plan." },
      ],
    },
  },
  {
    name: "Elena Novak", dob: "1988-06", countryCode: "VN", isExpat: true, firstFocus: "plan_retirement", risk: "balanced",
    holdings: [
      { key: "cash", body: { holdingType: "cash", label: "Vietcombank savings", bankName: "Vietcombank", accountType: "savings", currentBalance: 18000, interestRatePct: 4.6 } },
      { key: "vt", body: { holdingType: "stock_etf", label: "Vanguard Total World ETF", ticker: "VT", brokerPlatform: "Saxo", unitsHeld: 80, averageCostPrice: 100, purchaseDate: "2023-11-01" } },
      { key: "pension", body: { holdingType: "pension", label: "Czech supplementary pension", schemeName: "Doplňkové penzijní spoření", pensionCountry: "CZ", currentBalancePension: 22000 } },
    ],
    liabilities: [],
    goals: [
      { body: { title: "Comfortable retirement", goalType: "retire", targetAmount: 900000, monthlyContribution: 1500, targetDate: "2046-06-30", priority: "high" },
        links: [{ plan: true, pct: 100 }, { holding: "pension", pct: 100 }] },
      { body: { title: "Children's education fund", goalType: "education", targetAmount: 120000, monthlyContribution: 500, targetDate: "2036-08-31", priority: "high" },
        links: [{ holding: "vt", pct: 100 }] },
      { body: { title: "Emergency fund", goalType: "emergency", targetAmount: 20000, monthlyContribution: 0, targetDate: "2027-03-31", priority: "medium" },
        links: [{ holding: "cash", pct: 100 }] },
    ],
    budgetMonths: 7,
    budget: {
      income: { primaryIncome: 7800, otherIncome: 300 },
      expenses: { housing: 1400, utilities: 160, transport: 180, insurance: 250, foodDining: 800, entertainment: 300, shopping: 350, health: 150, education: 900 },
      contributions: [{ holding: "vt", amount: 500 }],
    },
    plan: {
      body: { providerName: "Harbor Life International", productName: "Global Savings Plan", planType: "rsp", currency: "USD", termYears: 20, annualPremium: 18000, initialPremium: 0, effectiveDate: PLAN_START, nickname: "Retirement savings plan" },
      policyNumber: "HLI-DEMO-00184",
      statements: [
        { ...quarter(6), contributions: 4500, fees: { policyFee: 45, assetManagementFee: 18 }, returns: 96 },
        { ...quarter(3), contributions: 4500, fees: { policyFee: 45, assetManagementFee: 30 }, returns: 210 },
      ],
      funds: [
        { fundCode: "HLI-GEQ", fundName: "Global Equity Fund", share: 0.7, futureAllocationPct: 70 },
        { fundCode: "HLI-ABF", fundName: "Asia Pacific Bond Fund", share: 0.3, futureAllocationPct: 30 },
      ],
      // An advisor's proposal, not in force: a scenario the client can see.
      proposal: { providerName: "Harbor Life International", productName: "Education Lump Sum Plan", planType: "lump_sum", currency: "USD", termYears: 10, initialPremium: 30000, annualPremium: 0, status: "scenario", nickname: "Education top-up (proposal)" },
      financialPlan: { title: "Retirement and education plan", milestones: [
        { title: "Savings plan in force", targetDate: PLAN_START, status: "completed" },
        { title: "Education fund at 50,000", targetDate: "2030-08-31" },
        { title: "Retirement plan review", targetDate: "2027-05-31" },
      ] },
      messages: [
        { from: "advisor", content: "Welcome, Elena. Your retirement savings plan is in force and linked to your retirement goal." },
        { from: "advisor", content: "I've also shared a proposal for an education lump sum. Have a look when you have time." },
        { from: "client", content: "Thanks, I'll read it this weekend." },
      ],
    },
  },
];

// ── The app, run in this process with the caller's identity injected. ─────────────────────────────

let base = "";
async function startApi(): Promise<() => Promise<void>> {
  const { default: router } = await import("../routes");
  const app = express();
  app.use(express.json());
  // Only reachable from this process, on loopback, for the length of the job.
  app.use((req, _res, next) => {
    const userId = req.header("x-seed-user") ?? null;
    (req as any).auth = () => ({ userId, tokenType: "session_token", sessionClaims: {}, debug: () => ({}) });
    next();
  });
  app.use("/api", router);
  const server = await new Promise<import("node:http").Server>((done) => {
    const s = app.listen(0, "127.0.0.1", () => done(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return () => new Promise((done) => server.close(() => done()));
}

async function call<T = any>(as: string, method: string, path: string, body?: unknown, okStatuses = [200, 201]): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method, headers: { "content-type": "application/json", "x-seed-user": as },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!okStatuses.includes(res.status)) throw new Error(`${method} ${path} answered ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

// ── Accounts ─────────────────────────────────────────────────────────────────────────────────────

async function clerkIdsFor(email: string): Promise<string[]> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY is not set; run this inside the deployment.");
  const apiBase = process.env.CLERK_API_URL ?? "https://api.clerk.com/v1";
  const res = await fetch(`${apiBase}/users?email_address=${encodeURIComponent(email)}&limit=10`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Could not check ${email} with the sign-in service (HTTP ${res.status}).`);
  return ((await res.json()) as Array<{ id: string }>).map((u) => u.id);
}

export function parseAccounts(value: string): Account[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean).map((item) => {
    const [role, email] = item.split("=").map((s) => s.trim());
    if (!["advisor", "free", "track_a", "track_b"].includes(role) || !email) {
      throw new Error(`"${item}" should look like role=email, with role advisor, free, track_a or track_b.`);
    }
    return { role: role as Role, email: email.toLowerCase() };
  });
}

interface Found { id: string; role: string; fullName: string | null; isMember: boolean; advisorId: string | null }

async function resolve(email: string): Promise<Found | string> {
  const ids = await clerkIdsFor(email);
  if (ids.length !== 1) return ids.length ? "has more than one sign-in" : "has no sign-in on the live site";
  const [p] = await db.select({ id: profilesTable.id, role: profilesTable.role, fullName: profilesTable.fullName })
    .from(profilesTable).where(eq(profilesTable.id, ids[0]));
  if (!p) return "has not signed in on the live site since the last update; sign in once";
  const [m] = await db.select().from(membershipsTable).where(eq(membershipsTable.userId, p.id));
  const [cp] = await db.select({ advisorId: clientProfilesTable.advisorId }).from(clientProfilesTable)
    .where(eq(clientProfilesTable.userId, p.id));
  return { ...p, isMember: isRowActive(m), advisorId: cp?.advisorId ?? null };
}

/**
 * Whether this person holds anything other than their own demo persona's records. A run that was
 * interrupted leaves part of the persona behind; that is carried on from, but anything else is the
 * person's own data and is never mixed with.
 */
async function foreignData(userId: string, p: Persona): Promise<string[]> {
  const found: string[] = [];
  const titles = new Set(p.goals.map((g) => g.body.title as string));
  const labels = new Set([...p.holdings.map((h) => h.body.label as string), "Surplus (auto)"]);
  const plans = new Set([p.plan?.body.nickname, p.plan?.proposal?.nickname].filter(Boolean) as string[]);
  const goals = await db.select({ title: financialGoalsTable.title }).from(financialGoalsTable).where(eq(financialGoalsTable.userId, userId));
  const holdings = await db.select({ label: clientHoldingsTable.label }).from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.userId, userId), eq(clientHoldingsTable.isActive, true)));
  const advised = await db.select({ nickname: advisedPlansTable.nickname }).from(advisedPlansTable).where(eq(advisedPlansTable.userId, userId));
  const budget = await db.select({ id: clientBudgetMonthsTable.id }).from(clientBudgetMonthsTable)
    .where(eq(clientBudgetMonthsTable.userId, userId)).limit(1);
  if (goals.some((g) => !titles.has(g.title))) found.push("goals");
  if (holdings.some((h) => !labels.has(h.label))) found.push("holdings");
  if (advised.some((a) => !a.nickname || !plans.has(a.nickname))) found.push("advised plans");
  // The persona's holdings come before its budget, so budget months without them are not the demo's.
  if (budget.length && !holdings.some((h) => labels.has(h.label) && h.label !== "Surplus (auto)")) found.push("budget months");
  return found;
}

const say = (line: string) => console.log(line);

// ── Building one person. Every step finds what an earlier, interrupted run already made. ─────────

async function onboard(id: string, p: Persona, keepName: string | null | undefined) {
  await call(id, "PUT", "/client/profile/basics", {
    ...(keepName ? {} : { fullName: p.name }), countryCode: p.countryCode, isExpat: p.isExpat,
    preferredCurrency: "USD", dateOfBirth: p.dob,
  });
  await call(id, "POST", "/client/onboarding/complete", { firstFocus: p.firstFocus });
  await call(id, "PUT", "/client-profile/me", { riskProfile: p.risk });
}

async function addWealth(id: string, p: Persona): Promise<Map<string, string>> {
  const holdingIds = new Map<string, string>();
  const have = await db.select({ id: clientHoldingsTable.id, label: clientHoldingsTable.label }).from(clientHoldingsTable)
    .where(and(eq(clientHoldingsTable.userId, id), eq(clientHoldingsTable.isActive, true)));
  for (const h of p.holdings) {
    const existing = have.find((x) => x.label === h.body.label);
    holdingIds.set(h.key, existing?.id ?? (await call(id, "POST", "/client/holdings", h.body)).id);
  }
  const debts = await db.select({ name: liabilitiesTable.name }).from(liabilitiesTable).where(eq(liabilitiesTable.userId, id));
  for (const l of p.liabilities) if (!debts.some((d) => d.name === l.name)) await call(id, "POST", "/liabilities", l);
  return holdingIds;
}

function budgetBody(p: Persona, month: string, i: number, holdingIds: Map<string, string>, extra: unknown[] = []) {
  return {
    month, currency: "USD", ...vary(p.budget.income, i), ...vary(p.budget.expenses, i),
    investmentContributions: [
      ...p.budget.contributions.map((c) => {
        const h = p.holdings.find((x) => x.key === c.holding)!;
        return { label: h.body.label, amount: c.amount, source_id: holdingIds.get(c.holding), source_type: "self_holding" };
      }),
      ...extra,
    ],
  };
}

// Saving a month again replaces it, so this is safe to repeat.
async function addBudgets(id: string, p: Persona, holdingIds: Map<string, string>) {
  const list = months(p.budgetMonths);
  for (const [i, month] of list.entries()) await call(id, "POST", "/client/budget", budgetBody(p, month, i, holdingIds));
  return list;
}

async function addGoals(id: string, p: Persona, holdingIds: Map<string, string>, planId?: string) {
  const have = await db.select({ id: financialGoalsTable.id, title: financialGoalsTable.title }).from(financialGoalsTable)
    .where(eq(financialGoalsTable.userId, id));
  for (const g of p.goals) {
    const goalId = have.find((x) => x.title === g.body.title)?.id ?? (await call(id, "POST", "/goals", { ...g.body, currency: "USD" })).id;
    const linked = await db.select({ sourceType: goalHoldingLinksTable.sourceType, sourceId: goalHoldingLinksTable.sourceId })
      .from(goalHoldingLinksTable).where(eq(goalHoldingLinksTable.goalId, goalId));
    for (const link of g.links) {
      const source = link.plan ? { sourceType: "advised_plan", sourceId: planId } : { sourceType: "self_holding", sourceId: holdingIds.get(link.holding!) };
      if (linked.some((l) => l.sourceType === source.sourceType && l.sourceId === source.sourceId)) continue;
      await call(id, "POST", `/client/goals/${goalId}/links`, { ...source, allocationPct: link.pct });
    }
  }
}

async function buildFree(acc: Account, p: Persona) {
  await onboard(acc.id!, p, acc.fullName);
  const holdingIds = await addWealth(acc.id!, p);
  await addBudgets(acc.id!, p, holdingIds);
  await addGoals(acc.id!, p, holdingIds);
}

async function buildMember(acc: Account, p: Persona, superAdminId: string) {
  await onboard(acc.id!, p, acc.fullName);
  // The way a member joins without paying: a super admin's comp. The app makes them a client.
  if (!acc.isMember) await call(superAdminId, "PUT", `/admin/users/${acc.id}/membership`, { action: "comp", reason: "Demo account for colleagues" });
  const holdingIds = await addWealth(acc.id!, p);
  await addBudgets(acc.id!, p, holdingIds);
  await addGoals(acc.id!, p, holdingIds);
}

async function buildAdvised(acc: Account, p: Persona, superAdminId: string, advisorId: string) {
  const id = acc.id!;
  const plan = p.plan!;
  await onboard(id, p, acc.fullName);
  // Asking to talk to an advisor creates the lead; the comp makes them a member; assigning the lead
  // to the advisor promotes them to the advisor's client.
  if (acc.advisorId !== advisorId) await call(id, "POST", "/leads/from-interest", { source: "C7_direct" });
  if (!acc.isMember) await call(superAdminId, "PUT", `/admin/users/${id}/membership`, { action: "comp", reason: "Demo account for colleagues" });
  if (acc.advisorId !== advisorId) {
    const [lead] = await db.select({ id: leadsTable.id }).from(leadsTable)
      .where(and(eq(leadsTable.userId, id), inArray(leadsTable.status, ["unassigned", "active", "cold"]))).limit(1);
    if (!lead) throw new Error("the interest did not create a lead");
    await call(superAdminId, "PUT", `/leads/${lead.id}/assign`, { advisorId });
  }
  say(`${acc.email}: client of the advisor`);

  const holdingIds = await addWealth(id, p);
  const budgetMonths = await addBudgets(id, p, holdingIds);

  // The advisor's work: the plan as a scenario, its statements, then in force with its policy number.
  const plans = await db.select({ id: advisedPlansTable.id, nickname: advisedPlansTable.nickname }).from(advisedPlansTable)
    .where(eq(advisedPlansTable.userId, id));
  const planId = plans.find((x) => x.nickname === plan.body.nickname)?.id
    ?? (await call(advisorId, "POST", `/advisor/clients/${id}/advised-plans`, { ...plan.body, status: "scenario" })).id;
  const statements = await db.select({ periodStart: advisedPlanStatementsTable.periodStart }).from(advisedPlanStatementsTable)
    .where(eq(advisedPlanStatementsTable.advisedPlanId, planId));
  let value = 0;
  let contributed = 0;
  for (const s of plan.statements) {
    const fees = Object.values(s.fees).reduce((a, b) => a + b, 0);
    const opening = value;
    value = Math.round((opening + s.contributions - fees + s.returns) * 100) / 100;
    contributed += s.contributions;
    if (statements.some((x) => x.periodStart === s.periodStart)) continue;
    await call(advisorId, "POST", `/advisor/clients/${id}/advised-plans/${planId}/statements`, {
      periodStart: s.periodStart, periodEnd: s.periodEnd, statementDate: s.periodEnd, entryMode: "summary",
      openingValue: opening, closingValue: value, contributions: s.contributions, investmentReturns: s.returns, ...s.fees,
      funds: plan.funds.map((f) => ({ fundCode: f.fundCode, fundName: f.fundName, holdingValue: Math.round(value * f.share * 100) / 100, futureAllocationPct: f.futureAllocationPct })),
      newLatestAccountValue: value, newLatestNetContribution: contributed,
    });
  }
  await call(advisorId, "PUT", `/advised-plans/${planId}/status`, { status: "inforce", policyNumber: plan.policyNumber });
  if (plan.proposal && !plans.some((x) => x.nickname === plan.proposal!.nickname)) {
    await call(advisorId, "POST", `/advisor/clients/${id}/advised-plans`, plan.proposal);
  }
  say(`${acc.email}: savings plan in force`);

  // Going in force wrote the plan's premium into each budget month. Saving each month again, as the
  // client would, settles the surplus that goes to cash.
  for (const [i, month] of budgetMonths.entries()) {
    const row = await call(id, "GET", `/client/budget/${month}`);
    const advised = ((row?.investmentContributions as any[]) ?? []).filter((c) => c?.source_type === "advised_plan");
    await call(id, "POST", "/client/budget", budgetBody(p, month, i, holdingIds, advised));
  }

  await addGoals(id, p, holdingIds, planId);

  const [existingPlan] = await db.select({ id: financialPlansTable.id }).from(financialPlansTable).where(eq(financialPlansTable.clientId, id));
  const fpId = existingPlan?.id
    ?? (await call(advisorId, "POST", `/advisor/clients/${id}/plan`, { title: plan.financialPlan.title, status: "active", nextReviewDate: "2027-05-31" })).id;
  const milestones = await db.select({ title: planMilestonesTable.title }).from(planMilestonesTable).where(eq(planMilestonesTable.planId, fpId));
  for (const m of plan.financialPlan.milestones) {
    if (!milestones.some((x) => x.title === m.title)) await call(advisorId, "POST", `/plans/${fpId}/milestones`, m);
  }

  // Returns the existing conversation if there is one.
  const conversation = await call(advisorId, "POST", "/conversations", { clientId: id });
  const [sent] = await db.select({ id: messagesTable.id }).from(messagesTable).where(eq(messagesTable.conversationId, conversation.id)).limit(1);
  if (!sent) {
    for (const m of plan.messages) {
      await call(m.from === "advisor" ? advisorId : id, "POST", `/conversations/${conversation.id}/messages`, { content: m.content });
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────

// By position in DEMO_ACCOUNTS, so a rerun gives each person the same persona.
function personaFor(accounts: Account[], acc: Account): Persona {
  if (acc.role === "free") return FREE;
  if (acc.role === "track_b") return TRACK_B;
  return TRACK_A[accounts.filter((a) => a.role === "track_a").indexOf(acc)];
}

export async function seedLiveDemo(accounts: Account[], apply: boolean): Promise<string[]> {
  const out: string[] = [];
  const problems: string[] = [];
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!superAdminEmail) throw new Error("SUPER_ADMIN_EMAIL is not set.");

  const admin = await resolve(superAdminEmail);
  if (typeof admin === "string") problems.push(`super admin ${superAdminEmail} ${admin}`);
  else if (admin.role !== "super_admin") problems.push(`super admin ${superAdminEmail} is ${admin.role}; check SUPER_ADMIN_EMAIL and sign in once`);

  const counts: Record<Role, number> = { advisor: 0, free: 0, track_a: 0, track_b: 0 };
  for (const acc of accounts) counts[acc.role]++;
  if (counts.advisor !== 1) problems.push("DEMO_ACCOUNTS needs exactly one advisor");
  if (counts.track_a > TRACK_A.length) problems.push(`there are ${TRACK_A.length} Track A personas`);
  if (counts.free > 1 || counts.track_b > 1) problems.push("one free and one Track B account at most");

  // Advisor first: the Track A checks compare against its id.
  const ordered = [...accounts].sort((a, b) => Number(b.role === "advisor") - Number(a.role === "advisor"));
  const toBuild: Account[] = [];
  for (const acc of ordered) {
    const found = await resolve(acc.email);
    if (typeof found === "string") { problems.push(`${acc.email} ${found}`); continue; }
    Object.assign(acc, { id: found.id, currentRole: found.role, fullName: found.fullName, isMember: found.isMember, advisorId: found.advisorId });
    if (acc.role === "advisor") {
      if (!["free_user", "advisor"].includes(found.role)) problems.push(`${acc.email} is ${found.role}, not an account to make the advisor`);
      continue;
    }
    const data = await foreignData(found.id, personaFor(accounts, acc));
    if (data.length) { out.push(`${acc.email}: skipped, already has its own ${data.join(", ")}`); continue; }
    // Starting points the app's own steps can carry on from.
    const advisorId = accounts.find((a) => a.role === "advisor")?.id;
    const fits = found.role === "free_user"
      || (found.role === "investment_client" && acc.role === "track_b" && !found.advisorId)
      || (found.role === "investment_client" && acc.role === "track_a" && (!found.advisorId || found.advisorId === advisorId));
    if (!fits) {
      problems.push(`${acc.email} is ${found.role}${found.advisorId ? " with another advisor" : ""}, which can't become the ${acc.role} demo`);
      continue;
    }
    toBuild.push(acc);
  }
  if (problems.length) throw new Error(`Nothing was changed. ${problems.join("; ")}.`);

  const plan = toBuild.map((acc) => ({ acc, persona: personaFor(accounts, acc) }));
  for (const { acc, persona } of plan) {
    const what = `${persona.goals.length} goal(s), ${persona.holdings.length} holdings, ${persona.liabilities.length} liabilities, ${persona.budgetMonths} budget months`;
    const how = acc.role === "free" ? "stays free" : acc.role === "track_b" ? "free membership from the super admin (Track B)"
      : "asks for an advisor, free membership, assigned to the advisor, savings plan in force (Track A)";
    out.push(`${acc.email}: ${how}; ${what}${acc.fullName ? "" : `; name set to ${persona.name}`}`);
  }
  const advisor = accounts.find((a) => a.role === "advisor")!;
  out.push(`${advisor.email}: ${advisor.currentRole === "advisor" ? "already the advisor" : "made the advisor by the super admin"}`);

  if (!apply) {
    out.push("Dry run: nothing was changed. Run again with --apply.");
    return out;
  }
  for (const line of out) say(line);
  out.length = 0;

  const stop = await startApi();
  try {
    const adminId = (admin as { id: string }).id;
    if (advisor.currentRole !== "advisor") {
      await call(adminId, "PUT", `/admin/users/${advisor.id}`, { role: "advisor", ...(advisor.fullName ? {} : { fullName: "Trang (Advisor)" }) });
    }
    for (const { acc, persona } of plan) {
      // Every step carries on from what is already there, so a failed attempt is simply repeated.
      for (let attempt = 1; ; attempt++) {
        try {
          say(`${acc.email}: building${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
          if (acc.role === "free") await buildFree(acc, persona);
          else if (acc.role === "track_b") await buildMember(acc, persona, adminId);
          else await buildAdvised(acc, persona, adminId, advisor.id!);
          if (acc.role !== "free") await computeNetWorth(acc.id!, { currency: "USD" }); // today's snapshot, as the nightly job takes
          say(`${acc.email}: done`);
          break;
        } catch (err) {
          const why = err instanceof Error ? err.message : String(err);
          say(`${acc.email}: attempt ${attempt} stopped: ${why}`);
          if (attempt === 3) { out.push(`${acc.email}: STOPPED part way, run again to finish: ${why}`); break; }
          await new Promise((r) => setTimeout(r, 5000));
          const again = await resolve(acc.email);
          if (typeof again !== "string") Object.assign(acc, { isMember: again.isMember, advisorId: again.advisorId, fullName: again.fullName });
        }
      }
    }
  } finally {
    await stop();
  }
  out.push("Applied.");
  return out;
}

// Run as the source (tsx) or as the bundle the API build makes (dist/seed/liveDemo.mjs).
if (/liveDemo\.(ts|mjs)$/.test(process.argv[1] ?? "")) {
  const apply = process.argv.includes("--apply");
  (async () => {
    try {
      const accounts = parseAccounts(process.env.DEMO_ACCOUNTS ?? "");
      if (!accounts.length) throw new Error("Set DEMO_ACCOUNTS.");
      for (const line of await seedLiveDemo(accounts, apply)) console.log(line);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    } finally {
      await pool.end().catch(() => {});
      process.exit();
    }
  })();
}
