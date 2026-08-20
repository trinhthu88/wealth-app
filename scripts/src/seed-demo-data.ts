import { eq } from "drizzle-orm";
import {
  db,
  profilesTable,
  clientProfilesTable,
  financialGoalsTable,
  budgetEntriesTable,
  budgetTransactionsTable,
  netWorthSnapshotsTable,
  assetsTable,
  liabilitiesTable,
  clientHoldingsTable,
  advisedPlansTable,
  advisedPlanStatementsTable,
  advisedPlanHoldingsTable,
  clientPackagesTable,
  portfolioSnapshotsTable,
  clientBudgetMonthsTable,
  advisorTasksTable,
} from "@workspace/db";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY not set");

const DEFAULT_PASSWORD = "Wealth@2024";
const ADVISOR_EMAIL = "trang.tt@hsp.consulting";

async function createClerkUser(email: string, fullName: string): Promise<string> {
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ") || undefined;

  const res = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password: DEFAULT_PASSWORD,
      first_name: firstName,
      last_name: lastName,
      skip_password_checks: true,
    }),
  });

  const data = (await res.json()) as any;

  if (!res.ok) {
    if (data.errors?.[0]?.code === "form_identifier_exists") {
      console.log(`  → already exists in Clerk, fetching ID…`);
      const search = await fetch(
        `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
        { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } },
      );
      const list = (await search.json()) as any;
      const found = Array.isArray(list)
        ? list.find((u: any) => u.email_addresses?.some((e: any) => e.email_address === email))
        : null;
      if (!found?.id) throw new Error(`Could not resolve existing Clerk user for ${email}`);
      return found.id as string;
    }
    throw new Error(`Clerk error for ${email}: ${JSON.stringify(data.errors ?? data)}`);
  }

  return data.id as string;
}

async function upsertProfile(profile: {
  id: string; email: string; fullName: string; role: string;
  preferredCurrency?: string; countryCode?: string | null; riskProfile?: string | null;
  onboardingComplete?: boolean; totalSavings?: string; totalInvestments?: string;
  savingsRatePercent?: string; investmentRatePercent?: string;
}) {
  await db.insert(profilesTable).values({
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    preferredCurrency: profile.preferredCurrency ?? "USD",
    countryCode: profile.countryCode ?? null,
    riskProfile: profile.riskProfile ?? null,
    onboardingComplete: profile.onboardingComplete ?? true,
    totalSavings: profile.totalSavings ?? "0",
    totalInvestments: profile.totalInvestments ?? "0",
    savingsRatePercent: profile.savingsRatePercent ?? "4.0",
    investmentRatePercent: profile.investmentRatePercent ?? "7.0",
  }).onConflictDoUpdate({
    target: profilesTable.id,
    set: {
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      preferredCurrency: profile.preferredCurrency ?? "USD",
      countryCode: profile.countryCode ?? null,
      riskProfile: profile.riskProfile ?? null,
      onboardingComplete: profile.onboardingComplete ?? true,
      totalSavings: profile.totalSavings ?? "0",
      totalInvestments: profile.totalInvestments ?? "0",
      savingsRatePercent: profile.savingsRatePercent ?? "4.0",
      investmentRatePercent: profile.investmentRatePercent ?? "7.0",
      updatedAt: new Date(),
    },
  });
}

async function seedFreeUser(
  id: string,
  email: string,
  fullName: string,
  opts: {
    riskProfile: string;
    totalSavings: string;
    goals: Array<Omit<typeof financialGoalsTable.$inferInsert, "userId">>;
    budgets: Array<Omit<typeof budgetEntriesTable.$inferInsert, "userId">>;
    transactions: Array<Omit<typeof budgetTransactionsTable.$inferInsert, "userId">>;
    netWorth: Array<Omit<typeof netWorthSnapshotsTable.$inferInsert, "userId">>;
    assets: Array<Omit<typeof assetsTable.$inferInsert, "userId">>;
    liabilities: Array<Omit<typeof liabilitiesTable.$inferInsert, "userId">>;
  },
) {
  await upsertProfile({
    id, email, fullName, role: "free_user",
    riskProfile: opts.riskProfile,
    totalSavings: opts.totalSavings,
  });

  for (const g of opts.goals) await db.insert(financialGoalsTable).values({ ...g, userId: id });
  for (const b of opts.budgets) await db.insert(budgetEntriesTable).values({ ...b, userId: id });
  for (const t of opts.transactions) await db.insert(budgetTransactionsTable).values({ ...t, userId: id });
  for (const n of opts.netWorth) await db.insert(netWorthSnapshotsTable).values({ ...n, userId: id });
  for (const a of opts.assets) await db.insert(assetsTable).values({ ...a, userId: id });
  for (const l of opts.liabilities) await db.insert(liabilitiesTable).values({ ...l, userId: id });
}

async function run() {
  console.log("\n🌱 Seeding demo data for free_user + investment_client, linked to advisor + super_admin\n");

  const [advisor] = await db.select().from(profilesTable).where(eq(profilesTable.email, ADVISOR_EMAIL));
  if (!advisor) {
    throw new Error(`Advisor ${ADVISOR_EMAIL} not found — run "pnpm --filter @workspace/scripts seed-users" first.`);
  }
  console.log(`→ Using advisor: ${advisor.fullName} (${advisor.id})`);

  const [superAdmin] = await db.select().from(profilesTable).where(eq(profilesTable.role, "super_admin"));
  if (superAdmin) console.log(`→ Existing super_admin found: ${superAdmin.email} (nothing to seed for this role — new users are auto-visible via /admin/users)\n`);

  // ── Free users ─────────────────────────────────────────────────────────
  console.log("── Free users ──");

  console.log(`→ sofia.chen@demo.wealthapp.io [free_user]`);
  const sofiaId = await createClerkUser("sofia.chen@demo.wealthapp.io", "Sofia Chen");
  await seedFreeUser(sofiaId, "sofia.chen@demo.wealthapp.io", "Sofia Chen", {
    riskProfile: "moderate",
    totalSavings: "18500",
    goals: [
      { title: "Emergency Fund", goalType: "emergency_fund", targetAmount: "20000", currentAmount: "14200", monthlyContribution: "500", targetDate: "2026-12-01", priority: "high", status: "on_track" },
      { title: "House Down Payment", goalType: "home_purchase", targetAmount: "80000", currentAmount: "22000", monthlyContribution: "800", targetDate: "2028-06-01", priority: "high", status: "on_track" },
      { title: "Japan Trip", goalType: "travel", targetAmount: "6000", currentAmount: "3200", monthlyContribution: "200", targetDate: "2027-03-01", priority: "low", status: "on_track" },
    ],
    budgets: [
      { periodMonth: "2026-06-01", income: "6200", housing: "1800", food: "650", transport: "300", utilities: "220", entertainment: "250", other: "180", needsActual: "2320", wantsActual: "1080", savingsActual: "800", savingsRatePercent: "13" },
      { periodMonth: "2026-07-01", income: "6200", housing: "1800", food: "620", transport: "310", utilities: "215", entertainment: "230", other: "175", needsActual: "2325", wantsActual: "1035", savingsActual: "900", savingsRatePercent: "14.5" },
      { periodMonth: "2026-08-01", income: "6300", housing: "1800", food: "640", transport: "295", utilities: "225", entertainment: "260", other: "170", needsActual: "2320", wantsActual: "1070", savingsActual: "950", savingsRatePercent: "15" },
    ],
    transactions: [
      { periodMonth: "2026-08", description: "Paycheck", amount: "6300", type: "income", category: "salary", transactionDate: "2026-08-01", isRecurring: true },
      { periodMonth: "2026-08", description: "Rent", amount: "1800", type: "expense", category: "housing", transactionDate: "2026-08-01", isRecurring: true },
      { periodMonth: "2026-08", description: "Grocery run", amount: "165", type: "expense", category: "food", transactionDate: "2026-08-05", isRecurring: false },
      { periodMonth: "2026-08", description: "Transit pass", amount: "120", type: "expense", category: "transport", transactionDate: "2026-08-03", isRecurring: true },
      { periodMonth: "2026-08", description: "Dinner with friends", amount: "68", type: "expense", category: "entertainment", transactionDate: "2026-08-12", isRecurring: false },
    ],
    netWorth: [
      { snapshotDate: "2026-06-30", totalAssetsUsd: "46000", totalLiabilitiesUsd: "8000", netWorthUsd: "38000" },
      { snapshotDate: "2026-07-31", totalAssetsUsd: "48500", totalLiabilitiesUsd: "7700", netWorthUsd: "40800" },
      { snapshotDate: "2026-08-20", totalAssetsUsd: "51200", totalLiabilitiesUsd: "7500", netWorthUsd: "43700" },
    ],
    assets: [
      { name: "Checking & Savings", category: "cash", valueUsd: "12000" },
      { name: "Brokerage (Index Funds)", category: "investment", valueUsd: "9200" },
      { name: "401k", category: "retirement", valueUsd: "22000" },
      { name: "Car", category: "vehicle", valueUsd: "8000" },
    ],
    liabilities: [
      { name: "Student Loan", category: "student_loan", balanceUsd: "6500", interestRatePercent: "4.5", monthlyPaymentUsd: "180" },
      { name: "Credit Card", category: "credit_card", balanceUsd: "1000", interestRatePercent: "19.9", monthlyPaymentUsd: "100" },
    ],
  });
  console.log(`  ✓ profile + 3 goals + 3 budgets + 5 transactions + 3 net worth snapshots + 4 assets + 2 liabilities\n`);

  console.log(`→ marcus.reyes@demo.wealthapp.io [free_user]`);
  const marcusId = await createClerkUser("marcus.reyes@demo.wealthapp.io", "Marcus Reyes");
  await seedFreeUser(marcusId, "marcus.reyes@demo.wealthapp.io", "Marcus Reyes", {
    riskProfile: "conservative",
    totalSavings: "1800",
    goals: [
      { title: "Emergency Fund", goalType: "emergency_fund", targetAmount: "10000", currentAmount: "1800", monthlyContribution: "150", targetDate: "2028-01-01", priority: "high", status: "behind" },
      { title: "Pay Off Credit Card", goalType: "debt_payoff", targetAmount: "4500", currentAmount: "1200", monthlyContribution: "300", targetDate: "2027-02-01", priority: "high", status: "on_track" },
    ],
    budgets: [
      { periodMonth: "2026-08-01", income: "3800", housing: "1400", food: "420", transport: "180", utilities: "150", entertainment: "120", other: "90", needsActual: "1750", wantsActual: "1860", savingsActual: "190", savingsRatePercent: "5" },
    ],
    transactions: [
      { periodMonth: "2026-08", description: "Paycheck", amount: "3800", type: "income", category: "salary", transactionDate: "2026-08-01", isRecurring: true },
      { periodMonth: "2026-08", description: "Rent", amount: "1400", type: "expense", category: "housing", transactionDate: "2026-08-01", isRecurring: true },
      { periodMonth: "2026-08", description: "Credit card payment", amount: "300", type: "expense", category: "other", transactionDate: "2026-08-10", isRecurring: true },
    ],
    netWorth: [
      { snapshotDate: "2026-08-20", totalAssetsUsd: "3800", totalLiabilitiesUsd: "3300", netWorthUsd: "500" },
    ],
    assets: [
      { name: "Savings Account", category: "cash", valueUsd: "1800" },
      { name: "Checking Account", category: "cash", valueUsd: "2000" },
    ],
    liabilities: [
      { name: "Credit Card Balance", category: "credit_card", balanceUsd: "3300", interestRatePercent: "22.5", monthlyPaymentUsd: "300" },
    ],
  });
  console.log(`  ✓ profile + 2 goals + 1 budget + 3 transactions + 1 net worth snapshot + 2 assets + 1 liability\n`);

  // ── Investment clients ────────────────────────────────────────────────
  console.log("── Investment clients (linked to advisor) ──");

  console.log(`→ elena.novak@demo.wealthapp.io [investment_client, Track A — advised]`);
  const elenaId = await createClerkUser("elena.novak@demo.wealthapp.io", "Elena Novak");
  await upsertProfile({ id: elenaId, email: "elena.novak@demo.wealthapp.io", fullName: "Elena Novak", role: "investment_client", riskProfile: "growth", totalInvestments: "185000", investmentRatePercent: "8.5" });

  await db.insert(clientProfilesTable).values({
    userId: elenaId, advisorId: advisor.id, status: "active", kycStatus: "verified",
    riskProfile: "growth", riskScore: 74, investmentStyle: "growth", indicativeAmount: "250000",
    onboardingStep: 6, prospectOnboardingComplete: true, fullOnboardingComplete: true,
    relationshipStartDate: "2024-02-15", annualReviewDate: "2027-02-15",
    clientTrack: "track_a", preferredDisplayCurrency: "USD", onboardingTrackComplete: true,
  }).onConflictDoNothing();

  const [elenaPlan] = await db.insert(advisedPlansTable).values({
    userId: elenaId, advisorId: advisor.id,
    providerName: "Friends Provident International", productCode: "RSP-GROWTH-25",
    productName: "Reserve Savings Plan", policyNumber: "FPI-88213",
    planType: "rsp", currency: "USD", termYears: 25,
    annualPremium: "14400", initialPremium: "5000",
    effectiveDate: "2024-03-01", maturityDate: "2049-03-01", status: "inforce",
    latestAccountValue: "38740", latestNetContribution: "31200", latestStatementDate: "2026-06-30",
    nickname: "Global Growth Plan", isVisibleToClient: true,
  }).returning();

  const [elenaStatementQ1] = await db.insert(advisedPlanStatementsTable).values({
    advisedPlanId: elenaPlan.id, userId: elenaId,
    periodStart: "2026-01-01", periodEnd: "2026-03-31", statementDate: "2026-04-05",
    openingValue: "30800", closingValue: "35560", contributions: "3600", extraAllocations: "0",
    investmentReturns: "1400", policyFee: "60", assetManagementFee: "90", adminCharges: "20",
    advisoryServicesFee: "40", bidOfferSpread: "30", surrenders: "0", surrenderCharges: "0",
    enteredBy: advisor.id, entryMode: "summary",
  }).returning();

  const [elenaStatementQ2] = await db.insert(advisedPlanStatementsTable).values({
    advisedPlanId: elenaPlan.id, userId: elenaId,
    periodStart: "2026-04-01", periodEnd: "2026-06-30", statementDate: "2026-07-05",
    openingValue: "35560", closingValue: "38740", contributions: "3600", extraAllocations: "0",
    investmentReturns: "-180", policyFee: "60", assetManagementFee: "90", adminCharges: "20",
    advisoryServicesFee: "40", bidOfferSpread: "30", surrenders: "0", surrenderCharges: "0",
    enteredBy: advisor.id, entryMode: "summary",
  }).returning();

  await db.insert(advisedPlanHoldingsTable).values([
    { statementId: elenaStatementQ2.id, advisedPlanId: elenaPlan.id, userId: elenaId, fundCode: "GEQ-100", fundName: "Global Equity Growth Fund", unitValueDate: "2026-06-30", unitValue: "18.42", unitsHeld: "1350.20", holdingValue: "24870", finalValue: "24870", futureAllocationPct: "65" },
    { statementId: elenaStatementQ2.id, advisedPlanId: elenaPlan.id, userId: elenaId, fundCode: "GBD-050", fundName: "Global Balanced Bond Fund", unitValueDate: "2026-06-30", unitValue: "11.05", unitsHeld: "1255.75", holdingValue: "13870", finalValue: "13870", futureAllocationPct: "35" },
  ]);

  await db.insert(financialGoalsTable).values({
    userId: elenaId, title: "Retirement at 60", goalType: "retirement",
    targetAmount: "800000", currentAmount: "185000", monthlyContribution: "1200",
    targetDate: "2049-01-01", priority: "high", status: "on_track", isAdvisorManaged: true,
  });

  const [elenaPackage] = await db.insert(clientPackagesTable).values({
    userId: elenaId, advisorId: advisor.id, nickname: "Global Growth Plan", status: "active",
    type: "rsp", monthlyAmount: "1200", lumpSumAmount: "5000", startDate: "2024-03-01",
    currency: "USD", expectedAnnualReturn: "8.5", advisorNotes: "Primary RSP — reviewed quarterly.",
  }).returning();

  await db.insert(portfolioSnapshotsTable).values([
    { clientPackageId: elenaPackage.id, userId: elenaId, snapshotDate: "2026-03-31", totalInvestedUsd: "33600", totalValueUsd: "35560", totalReturnPercent: "5.8" },
    { clientPackageId: elenaPackage.id, userId: elenaId, snapshotDate: "2026-06-30", totalInvestedUsd: "37200", totalValueUsd: "38740", totalReturnPercent: "4.1" },
  ]);

  await db.insert(clientBudgetMonthsTable).values([
    { userId: elenaId, month: "2026-07-01", primaryIncome: "9500", housing: "2400", utilities: "300", transport: "450", insurance: "350", foodDining: "780", entertainment: "380", shopping: "480", health: "200", education: "0", otherExpenses: "140", investmentContributions: [{ type: "rsp", amount: 1200 }], totalIncome: "9500", totalExpenses: "5430", totalInvestments: "1200", netSurplus: "2870", savingsRatePct: "30" },
    { userId: elenaId, month: "2026-08-01", primaryIncome: "9500", housing: "2400", utilities: "300", transport: "450", insurance: "350", foodDining: "800", entertainment: "400", shopping: "500", health: "200", education: "0", otherExpenses: "150", investmentContributions: [{ type: "rsp", amount: 1200 }], totalIncome: "9500", totalExpenses: "5550", totalInvestments: "1200", netSurplus: "2750", savingsRatePct: "29" },
  ]);

  console.log(`  ✓ profile + client_profile (advisorId=${advisor.id}) + advised plan + 2 statements + 2 fund holdings + goal + package + 2 snapshots + 2 budget months\n`);

  console.log(`→ james.whitfield@demo.wealthapp.io [investment_client, Track B — self-managed]`);
  const jamesId = await createClerkUser("james.whitfield@demo.wealthapp.io", "James Whitfield");
  await upsertProfile({ id: jamesId, email: "james.whitfield@demo.wealthapp.io", fullName: "James Whitfield", role: "investment_client", riskProfile: "balanced", totalInvestments: "142000", investmentRatePercent: "7.2" });

  await db.insert(clientProfilesTable).values({
    userId: jamesId, advisorId: advisor.id, status: "active", kycStatus: "verified",
    riskProfile: "balanced", riskScore: 58, investmentStyle: "balanced", indicativeAmount: "150000",
    onboardingStep: 6, prospectOnboardingComplete: true, fullOnboardingComplete: true,
    relationshipStartDate: "2023-11-01", annualReviewDate: "2026-11-01",
    clientTrack: "track_b", preferredDisplayCurrency: "USD", onboardingTrackComplete: true,
  }).onConflictDoNothing();

  await db.insert(clientHoldingsTable).values([
    { userId: jamesId, holdingType: "stock_etf", label: "US Total Market ETF", currency: "USD", purchaseDate: "2022-05-10", ticker: "VTI", brokerPlatform: "Charles Schwab", unitsHeld: "220", averageCostPrice: "195.40" },
    { userId: jamesId, holdingType: "crypto", label: "Bitcoin Holdings", currency: "USD", purchaseDate: "2021-09-01", coinSymbol: "BTC", exchangeName: "Coinbase", unitsHeld: "0.85", averageCostPrice: "38200" },
    { userId: jamesId, holdingType: "property", label: "Rental Condo — Austin TX", currency: "USD", purchaseDate: "2021-01-15", propertyAddress: "412 Riverside Dr, Austin, TX", country: "US", purchasePrice: "310000", currentEstimatedValue: "365000", outstandingMortgage: "210000", monthlyRentalIncome: "2100" },
    { userId: jamesId, holdingType: "cash", label: "High-Yield Savings", currency: "USD", bankName: "Ally Bank", accountType: "savings", currentBalance: "38000", interestRatePct: "4.25" },
  ]);

  await db.insert(financialGoalsTable).values([
    { userId: jamesId, title: "Financial Independence by 55", goalType: "financial_independence", targetAmount: "1500000", currentAmount: "142000", monthlyContribution: "2000", targetDate: "2041-01-01", priority: "high", status: "on_track" },
    { userId: jamesId, title: "Kids' College Fund", goalType: "education", targetAmount: "120000", currentAmount: "18000", monthlyContribution: "400", targetDate: "2034-08-01", priority: "medium", status: "on_track" },
  ]);

  await db.insert(clientBudgetMonthsTable).values([
    { userId: jamesId, month: "2026-07-01", primaryIncome: "14000", rentalIncome: "2100", housing: "3200", utilities: "380", transport: "600", insurance: "500", foodDining: "1080", entertainment: "580", shopping: "680", health: "300", education: "400", otherExpenses: "240", investmentContributions: [{ type: "self_managed", amount: 2000 }, { type: "college_fund", amount: 400 }], totalIncome: "16100", totalExpenses: "7960", totalInvestments: "2400", netSurplus: "5740", savingsRatePct: "36" },
    { userId: jamesId, month: "2026-08-01", primaryIncome: "14000", rentalIncome: "2100", housing: "3200", utilities: "380", transport: "600", insurance: "500", foodDining: "1100", entertainment: "600", shopping: "700", health: "300", education: "400", otherExpenses: "250", investmentContributions: [{ type: "self_managed", amount: 2000 }, { type: "college_fund", amount: 400 }], totalIncome: "16100", totalExpenses: "8030", totalInvestments: "2400", netSurplus: "5670", savingsRatePct: "35" },
  ]);

  console.log(`  ✓ profile + client_profile (advisorId=${advisor.id}) + 4 self-tracked holdings + 2 goals + 2 budget months\n`);

  // ── Advisor tasks (so the advisor's task list shows work for the new clients) ──
  await db.insert(advisorTasksTable).values([
    { advisorId: advisor.id, clientId: elenaId, title: "Quarterly portfolio review — Elena Novak", description: "Review Q2 statement performance and discuss rebalance.", dueDate: "2026-09-15", priority: "high", status: "todo" },
    { advisorId: advisor.id, clientId: jamesId, title: "KYC re-verification follow-up — James Whitfield", description: "Confirm updated proof of address before annual review.", dueDate: "2026-09-01", priority: "medium", status: "todo" },
  ]);
  console.log(`── Advisor tasks ──\n  ✓ 2 tasks assigned to ${advisor.email}\n`);

  console.log(`✅ Done! All new accounts use password: ${DEFAULT_PASSWORD}`);
  console.log(`   free_user:          sofia.chen@demo.wealthapp.io, marcus.reyes@demo.wealthapp.io`);
  console.log(`   investment_client:  elena.novak@demo.wealthapp.io (Track A), james.whitfield@demo.wealthapp.io (Track B)`);
  console.log(`   both clients are assigned to advisor ${advisor.email} and visible to any super_admin via /admin/users and /admin/clients.\n`);

  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
