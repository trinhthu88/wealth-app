import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import HealthScoreRing from "@/components/HealthScoreRing";
import SmartUpgradeCard from "@/components/SmartUpgradeCard";
import GoalCard from "@/components/GoalCard";
import WeeklyTipCard from "@/components/WeeklyTipCard";
import MilestoneChips from "@/components/MilestoneChips";
import BottomNav from "@/components/BottomNav";
import { Progress } from "@/components/ui/progress";
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
interface Asset { id: string; valueUsd: string; category: string; }
interface Liability { id: string; balanceUsd: string; }
interface Pathway { stepNumber: number; status: string; formData?: Record<string, unknown> | null; }

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

  const budget = budgets[budgets.length - 1];
  const incomeFromBudget = parseFloat(budget?.income ?? "0");
  // Fallback: pathway step 2 stores income in formData if budget entry was never created
  const pathwayStep2 = pathway.find(s => s.stepNumber === 2);
  const incomeFromPathway = parseFloat((pathwayStep2?.formData?.income as string | undefined) ?? "0");
  const income = incomeFromBudget > 0 ? incomeFromBudget : incomeFromPathway;
  const budgetExpenses = (["housing", "food", "transport", "utilities", "entertainment", "other"] as const)
    .reduce((s, k) => s + parseFloat((budget as any)?.[k] ?? "0"), 0);
  // Fallback: pathway step 3 stores housing/food/etc. in formData
  const pathwayStep3 = pathway.find(s => s.stepNumber === 3);
  const expensesFromPathway = pathwayStep3?.formData
    ? (["housing", "food", "transport", "utilities", "entertainment", "other"] as const)
        .reduce((s, k) => s + parseFloat(((pathwayStep3.formData as any)?.[k] as string | undefined) ?? "0"), 0)
    : 0;
  // expenses used for effective-rate / SmartUpgrade card — allows step 3 as first-month fallback
  const expenses = budgetExpenses > 0 ? budgetExpenses : expensesFromPathway;
  const monthlyCashSaved = Math.max(0, income - expenses);
  // Home tile shows the plain savings rate from the budget entry only (no pathway fallback).
  // Once the backfill useEffect runs, budgetExpenses will be populated from step 3,
  // so both always stay in sync.
  const savingsRate = income > 0 && budgetExpenses > 0
    ? ((income - budgetExpenses) / income) * 100
    : 0;

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

  const age = null as number | null;
  const benchmarkSavingsRate = getAgeBenchmarkSavingsRate(age);
  const goalStatus = projection?.status ?? topGoal?.status ?? "on_track";

  const weeklyTip = useMemo(() => generateWeeklyTip({
    effectiveSavingsRate,
    healthScore: score?.overallScore ?? 0,
    goal: topGoal ? { title: topGoal.title, monthlyShortfall: projection?.monthlyShortfall } : null,
    goalStatus,
    ageBenchmarkSavingsRate: benchmarkSavingsRate,
    streakWeeks,
    isExpat: profile?.isExpat ?? false,
    investmentRatePercent: invRatePct,
  }), [effectiveSavingsRate, score?.overallScore, topGoal, goalStatus, benchmarkSavingsRate, streakWeeks, profile?.isExpat, invRatePct]);


  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-4">
        {/* Greeting */}
        <div className="px-0.5 pt-0.5">
          <h1 className="text-xl font-bold">{getGreeting()}, {firstName}! 👋</h1>
          <p className="text-sm text-muted-foreground">Here's your financial overview</p>
        </div>

        {/* Pathway banner */}
        <AnimatePresence>
          {!pathwayDismissed && !profile?.onboardingComplete && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="bg-emerald-50 border border-primary/20 rounded-2xl p-4 relative overflow-hidden"
            >
              <button onClick={() => setPathwayDismissed(true)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              <div className="flex items-center gap-2 mb-2 pr-6">
                <span className="text-primary font-medium text-sm">Your plan is {Math.round(pathwayPct)}% complete</span>
              </div>
              <Progress value={pathwayPct} className="h-1.5 mb-3" />
              <Link href="/free/pathway">
                <span className="text-xs font-semibold text-primary">Continue setup →</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Health Score Card */}
        <Link href="/free/health-score">
          <div className="bg-[#042C53] rounded-2xl p-5 flex items-center gap-5 cursor-pointer hover:opacity-95 transition-opacity">
            <HealthScoreRing score={score?.overallScore ?? 0} size="md" animate darkMode />
            <div>
              <p className="text-blue-200 text-xs mb-0.5">Financial Health Score</p>
              <p className="text-white text-3xl font-bold">{score?.overallScore ?? "—"}<span className="text-base font-normal text-blue-300">/100</span></p>
              <p className="text-blue-200 text-xs mt-1">
                {!score ? "Complete your setup to get your score →" : score.overallScore >= 70 ? "Great work — keep building" : score.overallScore >= 50 ? "On track — a few quick wins ahead" : "Let's improve this together"}
              </p>
            </div>
          </div>
        </Link>

        {/* 2×2 Metric Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-card-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Monthly savings rate</p>
            <p className="text-2xl font-bold mt-1">{savingsRate > 0 ? `${savingsRate.toFixed(0)}%` : "—"}</p>
            <p className={`text-xs mt-1 font-medium ${savingsRate >= 20 ? "text-primary" : savingsRate >= 10 ? "text-amber-500" : "text-red-500"}`}>
              {savingsRate > 0 ? `Target: 20%` : "Set up budget →"}
            </p>
          </div>

          <div className="bg-card border border-card-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Net worth</p>
            <p className="text-2xl font-bold mt-1">{netWorth !== null ? fmt(netWorth) : "—"}</p>
            <p className={`text-xs mt-1 font-medium ${netWorth !== null ? (netWorth >= 0 ? "text-primary" : "text-red-500") : "text-primary"}`}>
              {netWorth !== null ? (netWorth >= 0 ? "↑ Growing" : "↓ Check debts") : "Track assets →"}
            </p>
          </div>

          <Link href="/free/goals" className="col-span-2">
            <div className="bg-card border border-card-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors">
              <p className="text-xs text-muted-foreground">Top goal</p>
              <p className="text-sm font-semibold mt-1 truncate">{topGoal?.title ?? "No goal set"}</p>
              {topGoal
                ? (<><Progress value={goalPct} className="h-1.5 mt-2 mb-1" /><p className="text-xs text-muted-foreground">{goalPct}% complete</p></>)
                : <p className="text-xs text-primary mt-1 font-medium">Set your first goal →</p>}
            </div>
          </Link>
        </div>

        {/* Weekly Tip */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">This week's insight</p>
          <WeeklyTipCard tip={weeklyTip} />
        </div>

        {/* Milestones */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Your achievements</p>
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

        {/* Top Goal Card */}
        {topGoal && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Your main goal</p>
            <GoalCard
              goal={topGoal}
              projection={projection}
              accountsBalance={savingsBalance + investmentValue}
              onContribute={() => window.location.href = "/free/goals"}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Quick actions</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { icon: "📊", label: "Update budget", href: "/free/budget" },
              { icon: "🎯", label: "Add to goal", href: "/free/goals" },
            ].map((a, i) => (
              <Link key={i} href={a.href}><div className="flex items-center gap-1.5 whitespace-nowrap bg-muted hover:bg-muted/80 rounded-full px-4 py-2 text-sm border border-border cursor-pointer transition-colors"><span>{a.icon}</span><span>{a.label}</span></div></Link>
            ))}
            <a href="/book" className="flex items-center gap-1.5 whitespace-nowrap bg-muted hover:bg-muted/80 rounded-full px-4 py-2 text-sm border border-border transition-colors">
              <Phone className="h-3.5 w-3.5" /><span>Book a call</span>
            </a>
          </div>
        </div>
      </div>

      <BottomNav />
    </AppShell>
  );
}
