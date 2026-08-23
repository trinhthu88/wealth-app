// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#FAF8F5, #F2EFE9, #A8A095)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Double bottom nav — AppShell is the ONLY nav

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import Sol from "@/components/Sol";
import SmartUpgradeCard from "@/components/SmartUpgradeCard";
import GoalCard, { toGoalCardData } from "@/components/shared/GoalCard";
import HealthScoreRing from "@/components/shared/HealthScoreRing";
import StatCard from "@/components/shared/StatCard";
import MilestoneChips from "@/components/MilestoneChips";
import BottomNav from "@/components/BottomNav";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { X, Phone, TrendingUp, BarChart3, Target } from "lucide-react";
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
  const scoreStatusText = !scoreVal ? "Complete setup" : scoreVal >= 85 ? "Excellent" : scoreVal >= 70 ? "Good shape" : scoreVal >= 50 ? "Fair" : "Needs attention";
  const scoreStatusColor = !scoreVal ? "var(--ink-40)" : scoreVal >= 70 ? "var(--green)" : scoreVal >= 50 ? "var(--sun-deep)" : "var(--clay)";

  return (
    <AppShell>
      <div className="pb-24 md:pb-0">

        {/* Greeting header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-5"
        >
          <div>
            <p className="text-[10px] tracking-[0.12em] uppercase text-ink-40 mb-[3px]">
              {formatDashboardDate()}
            </p>
            <h1 className="text-forest text-[22px] font-bold tracking-[-0.02em] leading-[1.2]">
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
                className="relative overflow-hidden rounded-[16px] p-4 bg-green-tint border border-green/20"
              >
                <button onClick={() => setPathwayDismissed(true)} className="absolute top-2 right-2 flex items-center justify-center text-ink-40 min-w-9 min-h-9" aria-label="Dismiss pathway banner"><X className="h-4 w-4" /></button>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <span className="text-[13px] font-semibold text-green">
                    {completedSteps} of 6 steps complete
                  </span>
                </div>
                <div className="h-1 rounded-full bg-green-tint overflow-hidden mb-2.5">
                  <div className="h-full rounded-full bg-green transition-[width] duration-300 ease-in-out" style={{ width: `${pathwayPct}%` }} />
                </div>
                <Link href="/free/pathway">
                  <span className="text-[12px] font-bold text-green">
                    {completedSteps === 0 ? "Start your financial pathway →" : "Continue setup →"}
                  </span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Score card */}
          <Link href="/free/health-score">
            <div
              className="bg-surface rounded-[20px] cursor-pointer hover:opacity-[0.97] transition-opacity p-[22px] shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
            >
              <div className="flex justify-center">
                {score === undefined ? (
                  /* Skeleton ring while loading */
                  <svg width={170} height={170} viewBox="0 0 170 170">
                    <circle cx={85} cy={85} r={ringR} fill="none" stroke="var(--green-tint)" strokeWidth={12} />
                    <circle cx={85} cy={85} r={44} fill="var(--paper)" />
                    <rect x={60} y={67} width={50} height={12} rx={6} fill="var(--hairline)" className="animate-pulse" />
                    <rect x={68} y={84} width={34} height={8} rx={4} fill="var(--hairline)" className="animate-pulse" />
                    <rect x={72} y={97} width={26} height={8} rx={4} fill="var(--hairline)" className="animate-pulse" />
                  </svg>
                ) : (
                  <div className="flex flex-col items-center">
                    <HealthScoreRing score={scoreVal} size="lg" />
                    <p className="text-[9px] tracking-[2px] text-ink-40 mt-2.5">
                      TALA SCORE
                    </p>
                    <p className="text-[12px] font-semibold mt-0.5" style={{ color: scoreStatusColor }}>
                      {scoreStatusText}
                    </p>
                  </div>
                )}
              </div>
              {/* Stats: savings rate as primary, saved + net worth as secondary */}
              <div className="border-t border-hairline pt-3.5">
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-[12px] text-ink-60">Savings rate this month</p>
                  <p className={`text-[18px] font-bold ${savingsRate > 0 ? "text-green" : "text-ink-40"}`}>
                    {savingsRate > 0 ? `${savingsRate.toFixed(0)}%` : "—"}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-ink-40">
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
              className="flex items-center justify-between rounded-[16px] px-[18px] py-[13px]"
              style={{ background: "linear-gradient(135deg, var(--sun-tint), var(--sun) 180%)" }}
            >
              <div>
                <p className="text-forest text-[15px] font-bold">
                  {streakWeeks}-week streak
                </p>
                <p className="text-[12px] text-ink-60 mt-0.5">
                  Consistency is your superpower.
                </p>
              </div>
              <span className="text-amber-500 bg-white/50 p-2 rounded-full"><TrendingUp className="h-5 w-5" /></span>
            </div>
          )}

          {/* Goals section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-forest text-[16px]">Your goals</h2>
              <Link href="/free/goals">
                <span className="text-[13px] font-semibold text-green">See all</span>
              </Link>
            </div>
            {goals.length === 0 ? (
              <Link href="/free/goals">
                <div className="bg-surface rounded-[20px] p-5 text-center cursor-pointer border-[1.5px] border-dashed border-hairline shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
                  <p className="text-[13px] text-ink-40">No goals yet.</p>
                  <p className="text-[13px] font-semibold text-green mt-1">Add your first goal →</p>
                </div>
              </Link>
            ) : (
              <div className="space-y-3">
                {goals.slice(0, 3).map((g, i) => {
                  const gStatus = i === 0 ? (projection?.status ?? g.status) : g.status;
                  const eyebrowColor = gStatus === "on_track" ? "var(--green)" : gStatus === "almost" ? "var(--sun-deep)" : "var(--clay)";
                  const eyebrowText = gStatus === "on_track" ? "ON TRACK" : gStatus === "almost" ? "AT RISK" : "OFF TRACK";
                  return (
                    <div key={g.id}>
                      <p className="text-[11px] tracking-[0.11em] uppercase mb-1.5" style={{ color: eyebrowColor }}>
                        {eyebrowText}
                      </p>
                      <GoalCard
                        goal={toGoalCardData(g, gStatus, i === 0 ? savingsBalance + investmentValue : 0)}
                        projection={i === 0 ? projection : undefined}
                        onEdit={() => window.location.href = "/free/goals"}
                        onContribute={() => window.location.href = "/free/goals"}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Budget summary */}
          <div className="space-y-3">
            <p className="text-[11px] tracking-[0.11em] uppercase text-ink-40">
              This month's budget
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Income" value={income > 0 ? fmt(income) : "$0"} />
              <StatCard label="Expenses" value={expenses > 0 ? fmt(expenses) : "$0"} />
            </div>
            <StatCard
              label="Saved this month"
              value={fmt(income > 0 || expenses > 0 ? income - expenses : 0)}
              trend={(income - expenses) > 0 ? "up" : (income - expenses) < 0 ? "down" : "neutral"}
            />
          </div>

          {/* Weekly tip */}
          <div>
            <p className="text-[11px] tracking-[0.11em] uppercase text-ink-40 mb-2">
              This week's insight
            </p>
            <div
              className="flex items-start gap-3 rounded-[16px] bg-green-tint px-4 py-3.5"
            >
              <Sol size="xs" animate="idle" showFace />
              <p className="text-[13px] text-green leading-[1.55] font-medium flex-1">
                {weeklyTip.body}
              </p>
            </div>
          </div>

          {/* Milestones — compact strip, always visible (folded in from the old standalone Badges nav item) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] tracking-[0.11em] uppercase text-ink-40">
                Your achievements
              </p>
              <Link href="/free/milestones" className="text-xs font-medium text-primary hover:underline">
                View all →
              </Link>
            </div>
            {earnedMilestones.length === 0 && !newlyEarned && (
              <p className="text-xs text-muted-foreground mb-2">
                {streakWeeks > 0 ? `${streakWeeks}-week streak — keep going to earn your first badge.` : "Check in weekly to start your streak and earn your first badge."}
              </p>
            )}
            <MilestoneChips earnedKeys={earnedMilestones} newlyEarned={newlyEarned} />
          </div>

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
              { icon: "", label: "Update budget", href: "/free/budget" },
              { icon: "", label: "Add to goal", href: "/free/goals" },
            ].map((a, i) => (
              <Link key={i} href={a.href}>
                <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 cursor-pointer transition-colors bg-hairline border border-hairline text-[13px] font-medium text-forest">
                  <span>{a.icon}</span><span>{a.label}</span>
                </div>
              </Link>
            ))}
            <a href="/book" className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 transition-colors bg-hairline border border-hairline text-[13px] font-medium text-forest">
              <Phone className="h-3.5 w-3.5" /><span>Book a call</span>
            </a>
          </div>

        </div>
      </div>

      <BottomNav />
    </AppShell>
  );
}
