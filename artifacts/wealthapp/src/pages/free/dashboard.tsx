import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import Sol from "@/components/Sol";
import SmartUpgradeCard from "@/components/SmartUpgradeCard";
import GoalCard from "@/components/GoalCard";
import MilestoneChips from "@/components/MilestoneChips";
import BottomNav from "@/components/BottomNav";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { X, Phone } from "lucide-react";
import { generateWeeklyTip, getAgeBenchmarkSavingsRate } from "@/lib/tipEngine";
import {
  checkAndAwardMilestones,
  getEarnedMilestones,
  getStreak,
  getRatesFromStorage,
} from "@/lib/milestones";
import { calculateProjection } from "@/lib/goalProjection";

interface HealthScore { overallScore: number; budgetScore: number; goalsScore: number; savingsScore: number; insights: Record<string, number> | null; }
interface Goal { id: string; title: string; goalType: string; status: string; targetAmount: string | null; currentAmount: string | null; monthlyContribution: string | null; currency: string; targetDate?: string | null; }
interface BudgetEntry { id?: string; periodMonth?: string; income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTransaction { id: string; amount: string; type: string; category: string; }
interface Asset { id: string; valueUsd: string; category: string; }
interface Liability { id: string; balanceUsd: string; }
interface Pathway { stepNumber: number; status: string; formData?: Record<string, unknown> | null; }

const currentMk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDashboardDate() {
  const d = new Date();
  const day = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${day} · ${month} ${d.getDate()}`;
}

export default function FreeDashboard() {
  const { profile } = useProfile();
  const [pathwayDismissed, setPathwayDismissed] = useState(false);
  const [streakWeeks, setStreakWeeks] = useState(0);
  const [earnedMilestones, setEarnedMilestones] = useState<string[]>([]);
  const [newlyEarned, setNewlyEarned] = useState<string | null>(null);
  const firstName = profile?.fullName?.split(" ")[0] ?? "there";

  useEffect(() => {
    setStreakWeeks(getStreak().weeks);
    setEarnedMilestones(getEarnedMilestones());
  }, []);

  const { data: score } = useQuery<HealthScore>({ queryKey: ["health-score"], queryFn: () => apiFetch<HealthScore>("/health-score"), retry: false });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["goals"], queryFn: () => apiFetch<Goal[]>("/goals"), retry: false });
  const { data: budgets = [] } = useQuery<BudgetEntry[]>({ queryKey: ["budget"], queryFn: () => apiFetch<BudgetEntry[]>("/budget"), retry: false });
  const { data: pathway = [] } = useQuery<Pathway[]>({ queryKey: ["pathway"], queryFn: () => apiFetch<Pathway[]>("/pathway"), retry: false });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["assets"], queryFn: () => apiFetch<Asset[]>("/assets"), retry: false });
  const { data: liabilities = [] } = useQuery<Liability[]>({ queryKey: ["liabilities"], queryFn: () => apiFetch<Liability[]>("/liabilities"), retry: false });
  const { data: currentMonthTx = [] } = useQuery<BudgetTransaction[]>({
    queryKey: ["budget-transactions", currentMk],
    queryFn: () => apiFetch<BudgetTransaction[]>(`/budget/transactions?month=${currentMk}`),
    retry: false,
  });

  // Transactions (actual) for the current month — same priority as budget page
  const txIncome = currentMonthTx.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const txExpenses = currentMonthTx.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

  const budget = budgets[budgets.length - 1];
  const incomeFromBudget = parseFloat(budget?.income ?? "0");
  // Fallback: pathway step 2 stores income in formData if budget entry was never created
  const pathwayStep2 = pathway.find(s => s.stepNumber === 2);
  const incomeFromPathway = parseFloat((pathwayStep2?.formData?.income as string | undefined) ?? "0");
  const estIncome = incomeFromBudget > 0 ? incomeFromBudget : incomeFromPathway;
  const budgetExpenses = (["housing", "food", "transport", "utilities", "entertainment", "other"] as const)
    .reduce((s, k) => s + parseFloat((budget as any)?.[k] ?? "0"), 0);
  // Fallback: pathway step 3 stores housing/food/etc. in formData
  const pathwayStep3 = pathway.find(s => s.stepNumber === 3);
  const expensesFromPathway = pathwayStep3?.formData
    ? (["housing", "food", "transport", "utilities", "entertainment", "other"] as const)
        .reduce((s, k) => s + parseFloat(((pathwayStep3.formData as any)?.[k] as string | undefined) ?? "0"), 0)
    : 0;
  const estExpenses = budgetExpenses > 0 ? budgetExpenses : expensesFromPathway;

  // Transactions take priority; estimates are the fallback (mirrors budget page logic)
  const totalIncome = txIncome > 0 ? txIncome : estIncome;
  const totalExpenses = txExpenses > 0 ? txExpenses : estExpenses;
  const income = totalIncome;

  // expenses used for effective-rate / SmartUpgrade card
  const expenses = totalExpenses;
  const monthlyCashSaved = Math.max(0, income - expenses);
  // Savings rate shown as long as we have any income signal
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  const completedSteps = pathway.filter(s => s.status === "completed").length;
  const pathwayPct = (completedSteps / 6) * 100;

  const totalAssetsInDB = assets.reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd ?? "0"), 0);

  // Prefer categorised asset rows; fall back to profile totals (set via pathway)
  const assetsSavings = assets.filter(a => a.category === "savings").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const assetsInvestment = assets.filter(a => a.category === "investment").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const savingsBalance = assetsSavings > 0 ? assetsSavings : parseFloat(profile?.totalSavings ?? "0");
  const investmentValue = assetsInvestment > 0 ? assetsInvestment : parseFloat(profile?.totalInvestments ?? "0");

  const { savingsRate: lsSavRate, investmentRate: lsInvRate } = getRatesFromStorage();
  const savRatePct = profile?.savingsRatePercent ? parseFloat(profile.savingsRatePercent) : lsSavRate;
  const invRatePct = profile?.investmentRatePercent ? parseFloat(profile.investmentRatePercent) : lsInvRate;

  // Net worth grows from the Step 5 base: savings + investment principal compound at their rates,
  // plus new cash savings accumulated from the monthly budget since the profile was created.
  const monthsElapsed = profile?.createdAt
    ? Math.max(0, (() => {
        const created = new Date(profile.createdAt);
        const now = new Date();
        return (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
      })())
    : 0;
  const projectedSavings = savingsBalance * Math.pow(1 + savRatePct / 100 / 12, monthsElapsed);
  const projectedInvestments = investmentValue * Math.pow(1 + invRatePct / 100 / 12, monthsElapsed);
  const accumulatedCash = monthlyCashSaved * monthsElapsed;
  // If assets are tracked in the DB use them directly; otherwise use growing profile totals
  const effectiveTotalAssets = totalAssetsInDB > 0
    ? totalAssetsInDB
    : (projectedSavings + projectedInvestments + accumulatedCash);
  const netWorth = (effectiveTotalAssets > 0 || totalLiabilities > 0) ? effectiveTotalAssets - totalLiabilities : null;

  const monthlyReturns = savingsBalance * (savRatePct / 100 / 12) + investmentValue * (invRatePct / 100 / 12);
  const effectiveSavingsRate = income > 0 ? ((monthlyCashSaved + monthlyReturns) / income) * 100 : 0;

  const topGoal = goals[0] ?? null;
  // Effective current = goal's tracked progress + existing savings & investment balances
  const effectiveCurrentAmount = parseFloat(topGoal?.currentAmount ?? "0") + savingsBalance + investmentValue;
  const goalPct = topGoal && parseFloat(topGoal.targetAmount ?? "0") > 0
    ? Math.min(100, Math.round(effectiveCurrentAmount / parseFloat(topGoal.targetAmount ?? "1") * 100))
    : 0;

  const projection = useMemo(() => {
    if (!topGoal?.targetDate || !topGoal.targetAmount) return undefined;
    return calculateProjection({
      currentAmount: effectiveCurrentAmount,
      targetAmount: parseFloat(topGoal.targetAmount ?? "0"),
      targetDate: topGoal.targetDate,
      monthlyCashSaved,
      savingsBalance,
      savingsRatePercent: savRatePct,
      investmentValue,
      investmentRatePercent: invRatePct,
    });
  }, [topGoal, effectiveCurrentAmount, monthlyCashSaved, savingsBalance, investmentValue, savRatePct, invRatePct]);

  useEffect(() => {
    if (!goals.length && !pathway.length && !score) return;
    const data = {
      goalsCount: goals.length,
      pathwayComplete: completedSteps >= 6,
      streakWeeks,
      netWorth: netWorth ?? 0,
      effectiveSavingsRate,
      goalOnTrack: projection?.status === "on_track" || topGoal?.status === "on_track",
      healthScore: score?.overallScore ?? 0,
      budgetMonthsCount: budgets.length,
    };
    const newly = checkAndAwardMilestones(data);
    if (newly.length > 0) {
      setEarnedMilestones(getEarnedMilestones());
      setNewlyEarned(newly[0]);
    }
  }, [goals.length, completedSteps, score?.overallScore, budgets.length]);

  // One-time backfill: if the budget entry has income but no expenses and pathway step 3
  // has expense data, silently patch the entry so all pages read consistent numbers.
  const budgetEntryId = budget?.id;
  useEffect(() => {
    if (!budgetEntryId) return;
    if (budgetExpenses > 0) return;
    if (expensesFromPathway <= 0) return;
    const fd = pathwayStep3?.formData as Record<string, unknown> | null | undefined;
    if (!fd) return;
    apiFetch(`/budget/${budgetEntryId}`, {
      method: "PUT",
      body: JSON.stringify({
        periodMonth: budget?.periodMonth,
        income: budget?.income ?? "0",
        housing: String(fd.housing ?? 0),
        food: String(fd.food ?? 0),
        transport: String(fd.transport ?? 0),
        utilities: String(fd.utilities ?? 0),
        entertainment: String(fd.entertainment ?? 0),
        other: String(fd.other ?? 0),
      }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["budget"] });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetEntryId]);

  const age = ((profile as any)?.age as number | null) ?? null;
  const benchmarkSavingsRate = getAgeBenchmarkSavingsRate(age);
  const goalStatus = projection?.status ?? topGoal?.status ?? "on_track";

  const weeklyTip = useMemo(() => {
    if (totalIncome === 0 && !score?.overallScore) {
      return {
        type: "market_context",
        title: "Start with the basics",
        body: "Set up your budget and financial pathway to get personalised weekly insights and your Financial Health Score.",
        actionLabel: "Start your pathway",
        actionRoute: "/free/pathway",
      };
    }
    return generateWeeklyTip({
      effectiveSavingsRate,
      healthScore: score?.overallScore ?? 0,
      goal: topGoal ? { title: topGoal.title, monthlyShortfall: projection?.monthlyShortfall } : null,
      goalStatus,
      ageBenchmarkSavingsRate: benchmarkSavingsRate,
      streakWeeks,
      isExpat: profile?.isExpat ?? false,
      investmentRatePercent: invRatePct,
    });
  }, [effectiveSavingsRate, score?.overallScore, topGoal, goalStatus, benchmarkSavingsRate, streakWeeks, profile?.isExpat, invRatePct, totalIncome]);


  const scoreVal = score?.overallScore || 0;
  const ringR = 68;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc * (1 - scoreVal / 100);
  const ringStroke = scoreVal >= 70 ? "#1D9E75" : scoreVal >= 50 ? "#F5B947" : scoreVal > 0 ? "#D86B5A" : "#E6F5EE";
  const scoreStatusText = !scoreVal ? "Complete setup" : scoreVal >= 85 ? "Excellent" : scoreVal >= 70 ? "Good shape" : scoreVal >= 50 ? "Fair" : "Needs attention";
  const scoreStatusColor = !scoreVal ? "#A8A095" : scoreVal >= 70 ? "#1D9E75" : scoreVal >= 50 ? "#E8A53C" : "#D86B5A";

  return (
    <AppShell>
      <div className="pb-24 md:pb-0">

        {/* Greeting header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-5"
        >
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A8A095", marginBottom: 3 }}>
              {formatDashboardDate()}
            </p>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, color: "#042C53", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {getGreeting()}, {firstName}.
            </h1>
          </div>
          <Sol size="sm" animate="idle" showFace />
        </motion.div>

        <div className="space-y-4">

          {/* Pathway banner */}
          <AnimatePresence>
            {!pathwayDismissed && completedSteps < 6 && !profile?.onboardingComplete && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="relative overflow-hidden rounded-[16px] p-4"
                style={{ background: "#E6F5EE", border: "1px solid rgba(29,158,117,0.2)" }}
              >
                <button onClick={() => setPathwayDismissed(true)} className="absolute top-2 right-2 flex items-center justify-center" style={{ color: "#A8A095", minWidth: 36, minHeight: 36 }} aria-label="Dismiss pathway banner"><X className="h-4 w-4" /></button>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#0F6E56" }}>
                    {completedSteps} of 6 steps complete
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: "#C8EDE0", overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", borderRadius: 999, background: "#1D9E75", width: `${pathwayPct}%`, transition: "width 0.4s ease" }} />
                </div>
                <Link href="/free/pathway">
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1D9E75" }}>
                    {completedSteps === 0 ? "Start your financial pathway →" : "Continue setup →"}
                  </span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Score card */}
          <Link href="/free/health-score">
            <div
              className="bg-white rounded-[20px] cursor-pointer hover:opacity-[0.97] transition-opacity"
              style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)", padding: 22 }}
            >
              <div className="flex justify-center">
                {score === undefined ? (
                  /* Skeleton ring while loading */
                  <svg width={170} height={170} viewBox="0 0 170 170">
                    <circle cx={85} cy={85} r={ringR} fill="none" stroke="#E6F5EE" strokeWidth={12} />
                    <circle cx={85} cy={85} r={44} fill="#FAF8F5" />
                    <rect x={60} y={67} width={50} height={12} rx={6} fill="#E6E1D8" className="animate-pulse" />
                    <rect x={68} y={84} width={34} height={8} rx={4} fill="#F2EFE9" className="animate-pulse" />
                    <rect x={72} y={97} width={26} height={8} rx={4} fill="#F2EFE9" className="animate-pulse" />
                  </svg>
                ) : (
                  <svg width={170} height={170} viewBox="0 0 170 170">
                    <circle cx={85} cy={85} r={ringR} fill="none" stroke="#E6F5EE" strokeWidth={12} />
                    <circle cx={85} cy={85} r={44} fill="#FAF8F5" />
                    <circle
                      cx={85} cy={85} r={ringR} fill="none"
                      stroke={ringStroke} strokeWidth={12} strokeLinecap="round"
                      strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                      transform="rotate(-90 85 85)"
                      style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                    />
                    <text x={85} y={72} textAnchor="middle" dominantBaseline="middle"
                      fontFamily="'Sora', sans-serif" fontSize={38} fontWeight={800}
                      fill="#042C53" letterSpacing={-1.5}>
                      {scoreVal > 0 ? scoreVal : "—"}
                    </text>
                    <text x={85} y={88} textAnchor="middle"
                      fontFamily="'JetBrains Mono', monospace" fontSize={9}
                      fill="#A8A095" letterSpacing={2}>
                      TALA SCORE
                    </text>
                    <text x={85} y={104} textAnchor="middle"
                      fontFamily="'Plus Jakarta Sans', sans-serif" fontSize={12}
                      fontWeight={600} fill={scoreStatusColor}>
                      {scoreStatusText}
                    </text>
                  </svg>
                )}
              </div>
              {/* Stats: savings rate as primary, saved + net worth as secondary */}
              <div style={{ borderTop: "1px solid #F2EFE9", paddingTop: 14 }}>
                <div className="flex items-baseline justify-between mb-1">
                  <p style={{ fontSize: 12, color: "#6B6459" }}>Savings rate this month</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: savingsRate > 0 ? "#1D9E75" : "#A8A095" }}>
                    {savingsRate > 0 ? `${savingsRate.toFixed(0)}%` : "—"}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p style={{ fontSize: 11, color: "#A8A095" }}>
                    {income > 0 || expenses > 0 ? `Saved ${fmt(Math.max(0, income - expenses))}` : "No budget data yet"}
                    {netWorth !== null ? ` · Net worth ${fmt(netWorth)}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </Link>

          {/* Streak banner */}
          {streakWeeks > 0 && (
            <div
              className="flex items-center justify-between rounded-[16px]"
              style={{ background: "linear-gradient(135deg, #FEF3D6, #F5B947 180%)", padding: "13px 18px" }}
            >
              <div>
                <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: "#042C53" }}>
                  {streakWeeks}-week streak
                </p>
                <p style={{ fontSize: 12, color: "#6B6459", marginTop: 2 }}>
                  Consistency is your superpower.
                </p>
              </div>
              <span style={{ fontSize: 26 }}>🔥</span>
            </div>
          )}

          {/* Goals section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: "#042C53" }}>Your goals</h2>
              <Link href="/free/goals">
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1D9E75" }}>See all</span>
              </Link>
            </div>
            {goals.length === 0 ? (
              <Link href="/free/goals">
                <div className="bg-white rounded-[20px] p-5 text-center cursor-pointer"
                  style={{ border: "1.5px dashed #E6E1D8", boxShadow: "0 4px 14px rgba(15,23,42,0.04)" }}>
                  <p style={{ fontSize: 13, color: "#A8A095" }}>No goals yet.</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1D9E75", marginTop: 4 }}>Add your first goal →</p>
                </div>
              </Link>
            ) : (
              <div className="space-y-3">
                {goals.slice(0, 3).map((g, i) => {
                  const gStatus = i === 0 ? (projection?.status ?? g.status) : g.status;
                  const eyebrowColor = gStatus === "on_track" ? "#1D9E75" : gStatus === "almost" ? "#E8A53C" : "#D86B5A";
                  const eyebrowText = gStatus === "on_track" ? "ON TRACK" : gStatus === "almost" ? "AT RISK" : "OFF TRACK";
                  return (
                    <div key={g.id}>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: eyebrowColor, marginBottom: 6 }}>
                        {eyebrowText}
                      </p>
                      <GoalCard
                        goal={g}
                        projection={i === 0 ? projection : undefined}
                        accountsBalance={i === 0 ? savingsBalance + investmentValue : undefined}
                        onContribute={() => window.location.href = "/free/goals"}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Budget summary */}
          <div className="bg-white rounded-[20px] p-4" style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#A8A095", marginBottom: 12 }}>
              This month's budget
            </p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p style={{ fontSize: 10, color: "#A8A095" }}>Income</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#042C53", marginTop: 2 }}>
                  {income > 0 ? fmt(income) : "$0"}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#A8A095" }}>Expenses</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#042C53", marginTop: 2 }}>
                  {expenses > 0 ? fmt(expenses) : "$0"}
                </p>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #F2EFE9", paddingTop: 10 }}>
              <p style={{ fontSize: 10, color: "#A8A095" }}>Saved this month</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, marginTop: 2, color: (income - expenses) > 0 ? "#1D9E75" : (income - expenses) < 0 ? "#D86B5A" : "#A8A095" }}>
                {fmt(income > 0 || expenses > 0 ? income - expenses : 0)}
              </p>
            </div>
          </div>

          {/* Weekly tip */}
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#A8A095", marginBottom: 8 }}>
              This week's insight
            </p>
            <div
              className="flex items-start gap-3 rounded-[16px]"
              style={{ background: "#E6F5EE", padding: "14px 16px" }}
            >
              <Sol size="xs" animate="idle" showFace />
              <p style={{ fontSize: 13, color: "#0F6E56", lineHeight: 1.55, fontWeight: 500, flex: 1 }}>
                {weeklyTip.body}
              </p>
            </div>
          </div>

          {/* Milestones */}
          {(earnedMilestones.length > 0 || !!newlyEarned) && (
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: "#A8A095", marginBottom: 8 }}>
                Your achievements
              </p>
              <MilestoneChips earnedKeys={earnedMilestones} newlyEarned={newlyEarned} />
            </div>
          )}

          {/* Smart Upgrade Cards */}
          <SmartUpgradeCard
            condition={income > 0 && effectiveSavingsRate < 15}
            insightText={`You're saving ${effectiveSavingsRate.toFixed(0)}% — reaching 20% could move your retirement forward by 2+ years`}
            ctaText="Book a free discovery call"
            ctaType="savings_rate"
          />
          <SmartUpgradeCard
            condition={goals.length > 0 && assets.filter(a => a.category === "investment").length === 0 && income > 0 && savingsRate >= 15}
            insightText="Your goal needs an investment strategy — an advisor can build your personalised roadmap"
            ctaText="Book a free discovery call"
            ctaType="no_investments"
          />
          <SmartUpgradeCard
            condition={(profile?.isExpat ?? false) && income > 0}
            insightText="As an expat, you may be missing tax and pension optimisations worth thousands per year"
            ctaText="Book a free discovery call"
            ctaType="expat"
          />

          {/* Quick actions */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { icon: "📊", label: "Update budget", href: "/free/budget" },
              { icon: "🎯", label: "Add to goal", href: "/free/goals" },
            ].map((a, i) => (
              <Link key={i} href={a.href}>
                <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 cursor-pointer transition-colors"
                  style={{ background: "#F2EFE9", border: "1px solid #E6E1D8", fontSize: 13, fontWeight: 500, color: "#042C53" }}>
                  <span>{a.icon}</span><span>{a.label}</span>
                </div>
              </Link>
            ))}
            <a href="/book" className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 transition-colors"
              style={{ background: "#F2EFE9", border: "1px solid #E6E1D8", fontSize: 13, fontWeight: 500, color: "#042C53" }}>
              <Phone className="h-3.5 w-3.5" /><span>Book a call</span>
            </a>
          </div>

        </div>
      </div>

      <BottomNav />
    </AppShell>
  );
}
