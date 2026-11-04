// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Achievement-unlocked card enter/exit (inside MilestoneChips)
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#F1F4FE, #F1F4FE, #8F98C8)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav — the shell's menu bar and section tabs are the ONLY nav

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import Sol from "@/components/Sol";
import SmartUpgradeCard from "@/components/SmartUpgradeCard";
import MilestoneChips from "@/components/MilestoneChips";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { queryClient } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { openSolChat } from "@/lib/solChat";
import { Target, RefreshCw, ArrowUpRight, ArrowDownRight, Wallet, Lock, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateWeeklyTip, getAgeBenchmarkSavingsRate } from "@/lib/tipEngine";
import type { Tip } from "@/lib/tipEngine";
import {
  MILESTONES,
  checkAndAwardMilestones,
  getEarnedMilestones,
  getStreak,
  getRatesFromStorage,
} from "@/lib/milestones";
import { calculateProjection } from "@/lib/goalProjection";

type WealthPeriod = "month" | "year" | "all";
const WEALTH_PERIOD_LABELS: Record<WealthPeriod, string> = { month: "this month", year: "past 12 months", all: "since you started tracking" };
const GOAL_TINTS = ["bg-field", "bg-breeze", "bg-surface"];

interface HealthScore { overallScore: number; budgetScore: number; goalsScore: number; savingsScore: number; insights: Record<string, number> | null; }
interface Goal { id: string; title: string; goalType: string; status: string; targetAmount: string | null; currentAmount: string | null; monthlyContribution: string | null; currency: string; targetDate?: string | null; }
interface BudgetEntry { id?: string; periodMonth?: string; income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTransaction { id: string; amount: string; type: string; category: string; }
interface Asset { id: string; valueUsd: string; category: string; }
interface Liability { id: string; balanceUsd: string; }
interface Pathway { stepNumber: number; status: string; formData?: Record<string, unknown> | null; }
interface NetWorthSnapshot { id: string; snapshotDate: string; netWorthUsd: string; }

const currentMk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

function getWeekKey(userId: string) {
  const d = new Date();
  const monday = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return `advisor_insight_${userId}_${monday.toISOString().slice(0, 10)}`;
}

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

function fmtFull(n: number, currency = "USD") {
  const sym = currency === "VND" ? "₫" : "$";
  return `${n < 0 ? "-" : ""}${sym}${Math.round(Math.abs(n)).toLocaleString()}`;
}

export default function FreeDashboard() {
  const { profile } = useProfile();
  const isFreeUser = profile?.role === "free_user";
  const [wealthPeriod, setWealthPeriod] = useState<WealthPeriod>("month");
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
  const { data: nwSnapshots = [] } = useQuery<NetWorthSnapshot[]>({
    queryKey: ["nw-snapshots"],
    queryFn: () => apiFetch<NetWorthSnapshot[]>("/client/networth/snapshots"),
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

  const netWorthDelta = nwSnapshots.length >= 2
    ? parseFloat(nwSnapshots[nwSnapshots.length - 1].netWorthUsd) - parseFloat(nwSnapshots[nwSnapshots.length - 2].netWorthUsd)
    : null;

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
      goalOnTrack: projection?.status === "on_track" || topGoal?.status === "active",
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
        actionRoute: "/free/onboarding",
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
      netWorthDelta,
      pathwayComplete: completedSteps >= 6,
      currency: profile?.preferredCurrency ?? "USD",
    });
  }, [effectiveSavingsRate, score?.overallScore, topGoal, goalStatus, benchmarkSavingsRate, streakWeeks, profile?.isExpat, invRatePct, totalIncome, netWorthDelta, completedSteps, profile?.preferredCurrency]);

  // Cache the advisor insight for the week so it doesn't change on every reload —
  // only when the user taps refresh or a new week starts.
  const [cachedTip, setCachedTip] = useState<Tip | null>(null);
  useEffect(() => {
    if (!profile?.id) return;
    const stored = localStorage.getItem(getWeekKey(profile.id));
    if (stored) { try { setCachedTip(JSON.parse(stored)); } catch { setCachedTip(null); } }
    else setCachedTip(null);
  }, [profile?.id]);
  useEffect(() => {
    if (!profile?.id || cachedTip) return;
    if (totalIncome === 0 && !score?.overallScore) return;
    localStorage.setItem(getWeekKey(profile.id), JSON.stringify(weeklyTip));
    setCachedTip(weeklyTip);
  }, [profile?.id, cachedTip, weeklyTip, totalIncome, score?.overallScore]);
  const advisorTip = cachedTip ?? weeklyTip;
  function refreshAdvisorTip() {
    if (!profile?.id) return;
    localStorage.setItem(getWeekKey(profile.id), JSON.stringify(weeklyTip));
    setCachedTip(weeklyTip);
  }

  const scoreVal = score?.overallScore || 0;
  const currency = profile?.preferredCurrency ?? "USD";
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long" });
  const saved = income - expenses;
  const hasBudget = income > 0 || expenses > 0;

  // Sol's one observation for the day — real numbers only, explains, never directs.
  const solLine = topGoal && parseFloat(topGoal.targetAmount ?? "0") > 0
    ? `${getGreeting()}, ${firstName}. You're ${goalPct}% of the way to ${topGoal.title}.`
    : savingsRate > 0
    ? `${getGreeting()}, ${firstName}. You kept ${savingsRate.toFixed(0)}% of your income this month.`
    : `${getGreeting()}, ${firstName}. Here's where things stand today.`;

  // Show one upgrade nudge at a time — the first one whose condition holds.
  const upgradeNudges = [
    {
      condition: income > 0 && effectiveSavingsRate < 15,
      insightText: `You're saving ${effectiveSavingsRate.toFixed(0)}% — reaching 20% could move your retirement forward by 2+ years`,
      ctaType: "savings_rate",
    },
    {
      condition: goals.length > 0 && assets.filter(a => a.category === "investment").length === 0 && income > 0 && savingsRate >= 15,
      insightText: "Your goal needs an investment strategy — an advisor can build your personalised roadmap",
      ctaType: "no_investments",
    },
    {
      condition: (profile?.isExpat ?? false) && income > 0,
      insightText: "As an expat, you may be missing tax and pension optimisations worth thousands per year",
      ctaType: "expat",
    },
  ];
  const activeNudge = upgradeNudges.find(n => n.condition && localStorage.getItem(`upgrade_dismissed_${n.ctaType}`) !== "1");


  // ── Net worth change for the Month / Year / All pills (from the stored snapshots) ──
  const trend = useMemo(
    () => nwSnapshots
      .map(s => ({ date: s.snapshotDate, netWorth: parseFloat(s.netWorthUsd) }))
      .filter(p => Number.isFinite(p.netWorth) && !Number.isNaN(new Date(p.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [nwSnapshots],
  );
  const latestPoint = trend[trend.length - 1] ?? null;
  const changeFor = (period: WealthPeriod): number | null => {
    if (trend.length < 2 || !latestPoint) return null;
    if (period === "all") return latestPoint.netWorth - trend[0].netWorth;
    const cutoff = new Date(latestPoint.date);
    if (period === "month") cutoff.setMonth(cutoff.getMonth() - 1);
    else cutoff.setFullYear(cutoff.getFullYear() - 1);
    const base = [...trend].reverse().find(p => new Date(p.date) <= cutoff) ?? trend[0];
    return latestPoint.netWorth - base.netWorth;
  };
  const wealthChange = changeFor(wealthPeriod);
  const wealthChangeBase = wealthChange != null && latestPoint ? latestPoint.netWorth - wealthChange : 0;
  const wealthChangePct = wealthChange != null && wealthChangeBase !== 0 ? (wealthChange / Math.abs(wealthChangeBase)) * 100 : null;

  const investmentHoldings = assets.filter(a => a.category === "investment").length;
  const goalTarget = parseFloat(topGoal?.targetAmount ?? "0");
  const goalOnTrack = goalStatus === "on_track" || goalStatus === "active";
  const atGoalCap = isFreeUser && goals.length >= 1;
  const pathwayIncomplete = completedSteps < 6 && !profile?.onboardingComplete;

  const arrowTile = (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest text-paper">
      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
    </span>
  );

  return (
    <AppShell>
      <div className="space-y-4 pb-8">
        {/* Net worth — the one key number on Home */}
        <section aria-label="Net worth" className="px-1 pt-1">
          <p className="text-[15px] font-medium text-ink-40">{getGreeting()}, {firstName} — your net worth</p>
          <Link href="/free/networth" className="mt-2.5 block rounded-[16px]">
            <span className="font-display tabular-nums text-[60px] leading-[0.95] tracking-[-0.045em] text-forest">
              {netWorth !== null ? fmtFull(netWorth, currency) : "—"}
            </span>
          </Link>
          {netWorth === null ? (
            <p className="mt-3 text-[13px] text-ink-40">Add your savings and investments to see it.</p>
          ) : wealthChange != null ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-forest tabular-nums",
                  wealthChange >= 0 ? "bg-field" : "bg-sun",
                )}>
                  {wealthChange >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  {fmt(Math.abs(wealthChange))}
                  {wealthChangePct != null && <> · {Math.abs(wealthChangePct).toFixed(1)}%</>}
                </span>
                <span className="text-[14px] text-ink-40">{WEALTH_PERIOD_LABELS[wealthPeriod]}</span>
              </div>
              <div role="group" aria-label="Time range" className="mt-3 flex gap-1.5">
                {(["month", "year", "all"] as const).map(period => (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={wealthPeriod === period}
                    onClick={() => setWealthPeriod(period)}
                    className={cn(
                      "h-10 rounded-full px-[18px] text-[14px] font-semibold transition-colors",
                      wealthPeriod === period ? "bg-forest text-paper" : "border-[1.5px] border-hairline-2 text-forest hover:border-forest",
                    )}
                  >
                    {period === "month" ? "Month" : period === "year" ? "Year" : "All"}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13px] text-ink-40">Your trend will appear as you update your values over time.</p>
          )}
        </section>

        {/* Where it is: investments (Cobalt), cash, health score */}
        <section aria-label="Where your money is" className="grid grid-cols-2 gap-3">
          <Link
            href={investmentHoldings > 0 ? "/free/portfolio" : "/free/networth"}
            className="row-span-2 flex min-h-[250px] flex-col justify-between rounded-[28px] bg-forest p-[18px] text-paper"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="tala-eyebrow text-mint">Investments</span>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-field text-forest">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div>
              <div className="font-display tabular-nums text-[38px] leading-none tracking-[-0.04em]">{fmt(investmentValue)}</div>
              <div className="mt-2 text-[12.5px] leading-snug text-mint tabular-nums">
                {investmentHoldings > 0
                  ? `${investmentHoldings} ${investmentHoldings === 1 ? "holding" : "holdings"} · tracked by you`
                  : investmentValue > 0
                  ? `Growing at ${invRatePct}% a year · from your pathway`
                  : "Add what you've invested"}
              </div>
            </div>
          </Link>
          <Link href="/free/networth" className="flex flex-col gap-4 rounded-[28px] bg-sun p-4">
            <span className="tala-eyebrow text-forest">Cash</span>
            <span className="font-display tabular-nums text-[28px] leading-none tracking-[-0.04em] text-forest">{fmt(savingsBalance)}</span>
          </Link>
          <Link href="/free/health-score" className="flex flex-col gap-4 rounded-[28px] bg-field p-4">
            <span className="tala-eyebrow text-forest">Health score</span>
            {score === undefined ? (
              <span className="h-7 w-16 animate-pulse rounded-[12px] bg-forest/10" aria-hidden="true" />
            ) : (
              <span className="font-display tabular-nums text-[28px] leading-none tracking-[-0.04em] text-forest">
                {scoreVal || "—"}<span className="text-[16px]">/100</span>
              </span>
            )}
          </Link>
        </section>

        {/* New badge celebration */}
        {newlyEarned && <MilestoneChips earnedKeys={earnedMilestones} newlyEarned={newlyEarned} />}

        {/* Sol noticed — one real observation, explains, never directs */}
        <section aria-label="Sol noticed" className="space-y-3.5 rounded-[28px] bg-forest p-5 text-paper">
          <div className="flex items-center gap-2.5">
            <Sol size="sm" animate="breathe" />
            <span className="tala-eyebrow text-field">Sol noticed</span>
          </div>
          {topGoal && goalTarget > 0 ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="font-display tabular-nums text-[48px] leading-[0.9] tracking-[-0.04em] text-sun">{goalPct}%</span>
                <span className="text-[15px] leading-snug text-paper">of the way to {topGoal.title}</span>
              </div>
              <p className="text-[13.5px] leading-[1.55] text-mint text-pretty tabular-nums">
                That counts your savings and investments toward the {fmtFull(goalTarget, topGoal.currency)} target
                {projection?.monthlyShortfall && projection.monthlyShortfall > 0
                  ? ` — about ${fmt(projection.monthlyShortfall)} more a month would close the gap.`
                  : "."}
              </p>
            </>
          ) : savingsRate > 0 ? (
            <div className="flex items-baseline gap-3">
              <span className="font-display tabular-nums text-[48px] leading-[0.9] tracking-[-0.04em] text-sun">{savingsRate.toFixed(0)}%</span>
              <span className="text-[15px] leading-snug text-paper">of your income kept in {monthLabel}</span>
            </div>
          ) : (
            <p className="text-[16px] leading-snug">{solLine}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {topGoal && goalTarget > 0 ? (
              <Link href="/free/goals" className="inline-flex h-11 items-center rounded-full bg-field px-[18px] text-[14px] font-semibold text-forest">
                See your goal
              </Link>
            ) : (
              <Link href="/free/budget" className="inline-flex h-11 items-center rounded-full bg-field px-[18px] text-[14px] font-semibold text-forest">
                {hasBudget ? "See the budget" : "Set up your budget"}
              </Link>
            )}
            <button type="button" onClick={openSolChat} className="h-11 rounded-full border-[1.5px] border-paper/80 px-[18px] text-[14px] font-semibold text-paper">
              Ask Sol
            </button>
          </div>
        </section>

        {/* Monthly budget — Budget's entry point from Home */}
        <Link href="/free/budget" className="flex items-center gap-3.5 rounded-[24px] bg-surface p-3 transition-colors hover:ring-1 hover:ring-green">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[16px] bg-field text-forest">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tala-eyebrow text-ink-40">{monthLabel} budget</div>
            <div className="mt-1 text-[15px] font-semibold text-forest tabular-nums">
              {hasBudget ? (
                <><span className={saved < 0 ? "text-clay-ink" : undefined}>{fmt(saved)}</span> kept{savingsRate > 0 && <> · {savingsRate.toFixed(0)}% savings rate</>}</>
              ) : (
                "Set up this month's budget"
              )}
            </div>
          </div>
          {arrowTile}
        </Link>

        {/* This week's insight — cached per week, refreshable */}
        <section aria-label="This week's insight" className="relative flex gap-3 rounded-[24px] bg-breeze p-4 pr-14">
          <Sol size="sm" animate="none" className="shrink-0" />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-forest">{advisorTip.title}</div>
            <p className="mt-0.5 text-[13px] leading-[1.5] text-forest text-pretty">{advisorTip.body}</p>
            {advisorTip.actionLabel && advisorTip.actionRoute && (
              <Link href={advisorTip.actionRoute} className="mt-2 inline-flex min-h-11 items-center text-[14px] font-semibold text-forest underline underline-offset-4">
                {advisorTip.actionLabel}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={refreshAdvisorTip}
            aria-label="Refresh insight"
            className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/10"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>

        {/* Goals */}
        <section aria-label="Your goals" className="space-y-3 pt-1">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-sans text-[16px] font-semibold text-forest">Goals</h2>
            <Link href="/free/goals" className="text-[14px] font-semibold text-forest underline underline-offset-4">See all</Link>
          </div>
          <div className="-mx-[22px] flex gap-3 overflow-x-auto px-[22px] pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
            {goals.length === 0 && (
              <Link href="/free/goals" className="flex w-[168px] flex-none flex-col gap-2.5 rounded-[28px] bg-surface p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-field text-forest">
                  <Target className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-[14px] font-semibold text-forest">Set your first goal</span>
                <span className="text-[13px] leading-snug text-ink-40">Give your plan a direction</span>
              </Link>
            )}
            {goals.map((g, i) => {
              const target = parseFloat(g.targetAmount ?? "0");
              const pct = i === 0
                ? goalPct
                : target > 0 ? Math.min(100, Math.round((parseFloat(g.currentAmount ?? "0") / target) * 100)) : 0;
              return (
                <Link key={g.id} href="/free/goals" className={cn("flex w-[168px] flex-none flex-col gap-2.5 rounded-[28px] p-4", GOAL_TINTS[i % GOAL_TINTS.length])}>
                  <span className="truncate text-[14px] font-semibold text-forest">{g.title}</span>
                  {target > 0 ? (
                    <>
                      <span className="font-display tabular-nums text-[40px] leading-[0.9] tracking-[-0.04em] text-forest">{pct}%</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-forest/20">
                        <span className="block h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
                      </span>
                    </>
                  ) : (
                    <span className="text-[14px] text-forest tabular-nums">{fmt(parseFloat(g.currentAmount ?? "0"))} saved</span>
                  )}
                  {i === 0 ? (
                    <span className={cn(
                      "self-start rounded-full px-2.5 py-1 text-[12px] font-semibold",
                      goalOnTrack ? "bg-forest text-paper" : "bg-sun text-forest",
                    )}>
                      {goalOnTrack ? "On track" : goalStatus === "almost" ? "At risk" : "Off track"}
                    </span>
                  ) : g.targetDate ? (
                    <span className="text-[12.5px] text-forest/80">by {new Date(g.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  ) : null}
                </Link>
              );
            })}
            {atGoalCap && (
              <Link
                href="/free/advisor"
                onClick={() => track("upgrade_cta_clicked", { location: "dashboard_locked_goal_slot" })}
                className="flex w-[168px] flex-none flex-col gap-2.5 rounded-[28px] bg-breeze p-4 text-forest"
              >
                <Lock className="h-7 w-7" aria-hidden="true" />
                <span className="text-[14px] font-semibold">Add a 2nd goal</span>
                <span className="text-[13px] leading-snug">Free plan tracks one goal at a time</span>
                <span className="mt-auto self-start rounded-full bg-forest px-2.5 py-1 text-[12px] font-semibold text-paper">Unlock</span>
              </Link>
            )}
          </div>
        </section>

        {/* Keep going */}
        <section aria-label="Keep going" className="space-y-3 pt-1">
          <h2 className="px-1 font-sans text-[16px] font-semibold text-forest">Keep going</h2>

          {pathwayIncomplete && (
            <Link href="/free/onboarding" className="flex items-center gap-3.5 rounded-[28px] bg-surface p-3">
              <div className="flex h-[72px] w-[72px] flex-none flex-col items-center justify-center rounded-[20px] bg-breeze text-forest">
                <span className="font-display tabular-nums text-[30px] leading-[0.9]">{completedSteps}<span className="text-[16px]">/6</span></span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em]">Steps</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-forest">{completedSteps === 0 ? "Start your pathway" : "Finish your pathway"}</div>
                <div className="mt-2 flex gap-1" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < completedSteps ? "bg-forest" : "bg-forest/15")} />
                  ))}
                </div>
                <div className="mt-1.5 text-[13px] text-ink-40">{completedSteps} of 6 steps done</div>
              </div>
              {arrowTile}
            </Link>
          )}

          <Link href="/free/milestones" className="flex items-center gap-3.5 rounded-[28px] bg-surface p-3">
            <div className="flex h-[72px] w-[72px] flex-none flex-col items-center justify-center rounded-[20px] bg-field text-forest">
              <span className="font-display tabular-nums text-[30px] leading-[0.9]">{streakWeeks}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em]">{streakWeeks === 1 ? "Week" : "Weeks"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold text-forest">Check-in streak</div>
              <div className="mt-0.5 text-[13px] text-ink-40 tabular-nums">
                {earnedMilestones.length > 0
                  ? `${earnedMilestones.length} of ${MILESTONES.length} badges earned`
                  : "Check in weekly to earn your first badge"}
              </div>
            </div>
            {arrowTile}
          </Link>

          <Link
            href="/free/advisor"
            onClick={() => track("upgrade_cta_clicked", { location: "dashboard_free_call" })}
            className="flex items-center gap-3.5 rounded-[28px] bg-surface p-3"
          >
            <div className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-[20px] bg-breeze text-forest">
              <UserRound className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold text-forest">Free 20-min call</div>
              <div className="mt-0.5 text-[13px] text-ink-40 text-pretty">Talk your plan through with a tala advisor</div>
            </div>
            {arrowTile}
          </Link>
        </section>

        {/* One upgrade nudge at a time */}
        {activeNudge && (
          <SmartUpgradeCard
            condition
            insightText={activeNudge.insightText}
            ctaText="Book a free discovery call"
            ctaType={activeNudge.ctaType}
          />
        )}
      </div>
    </AppShell>
  );
}
