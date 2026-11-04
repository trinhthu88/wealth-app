// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#F1F4FE, #F1F4FE, #8F98C8)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav — the shell's menu bar and section tabs are the ONLY nav

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import Sol from "@/components/Sol";
import SmartUpgradeCard from "@/components/SmartUpgradeCard";
import PlanPicker from "@/components/PlanPicker";
import BottomSheet from "@/components/client/BottomSheet";
import SolNarration from "@/components/client/SolNarration";
import MilestoneChips from "@/components/MilestoneChips";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { queryClient } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { X, Target, RefreshCw, ArrowUpRight, Wallet, Flame, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateWeeklyTip, getAgeBenchmarkSavingsRate } from "@/lib/tipEngine";
import type { Tip } from "@/lib/tipEngine";
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
  const isSubscribed = profile?.role === "investment_client";
  const manageSubscription = useManageSubscription();
  const [planPickerOpen, setPlanPickerOpen] = useState(false);

  function handleConversionCtaClick(location: string) {
    track("upgrade_cta_clicked", { location, action: isSubscribed ? "manage_subscription" : "open_plan_picker" });
    if (isSubscribed) {
      manageSubscription.mutate();
      return;
    }
    setPlanPickerOpen(true);
  }
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
  const scoreStatusText = !scoreVal ? "Complete setup to see your score" : scoreVal >= 85 ? "Excellent" : scoreVal >= 70 ? "Good shape" : scoreVal >= 50 ? "Fair" : "Needs attention";
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

  // Spark line from the stored net-worth snapshots.
  const sparkVals = nwSnapshots.map(s => parseFloat(s.netWorthUsd)).filter(v => Number.isFinite(v));

  // Score arc on the Cobalt hero card.
  const arcR = 44;
  const arcLen = Math.PI * arcR;
  const arcFill = (Math.min(100, Math.max(0, scoreVal)) / 100) * arcLen;

  return (
    <AppShell>
      <div className="space-y-4 pb-8">
        <SolNarration line={solLine} detail={advisorTip.body} className="mb-0 px-1" />

        {/* Pathway setup — only until the six steps are done */}
        <AnimatePresence>
          {!pathwayDismissed && completedSteps < 6 && !profile?.onboardingComplete && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="relative rounded-[24px] bg-breeze p-5 pr-14"
            >
              <button
                onClick={() => setPathwayDismissed(true)}
                className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest hover:bg-forest/10"
                aria-label="Dismiss pathway banner"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="tala-eyebrow text-forest">Your pathway · {completedSteps} of 6</div>
              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={cn("h-2 flex-1 rounded-full", i < completedSteps ? "bg-forest" : "bg-forest/15")} />
                ))}
              </div>
              <Link
                href="/free/onboarding"
                className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
              >
                {completedSteps === 0 ? "Start your pathway" : "Continue setup"}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Net worth — the one key number on Home */}
        <Link href="/free/networth" className="block rounded-[24px] px-1 pt-2 pb-1 transition-colors hover:bg-surface/60">
          <span className="tala-eyebrow text-ink-40">Net worth</span>
          <div className="font-display tabular-nums text-[56px] leading-none tracking-[-0.04em] text-forest mt-2.5">
            {netWorth !== null ? fmtFull(netWorth, currency) : "—"}
          </div>
          <div className="text-[14px] text-ink-40 mt-2.5 tabular-nums">
            {netWorth === null
              ? "Add your savings and investments to see it"
              : netWorthDelta !== null && netWorthDelta !== 0
              ? <><span className={cn("font-semibold", netWorthDelta > 0 ? "text-forest" : "text-clay-ink")}>{netWorthDelta > 0 ? "+" : "-"}{fmt(Math.abs(netWorthDelta))}</span> since your last update</>
              : `${fmt(savingsBalance)} saved · ${fmt(investmentValue)} invested`}
          </div>
          {sparkVals.length >= 2 && (
            <div className="mt-3 h-[52px] w-full" role="img" aria-label="Net worth trend over time">
              <svg viewBox="0 0 300 52" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                {(() => {
                  const w = 300, h = 52;
                  const min = Math.min(...sparkVals), max = Math.max(...sparkVals);
                  const range = max - min || 1;
                  const pts = sparkVals.map((v, i) => [(i / (sparkVals.length - 1)) * w, h - 6 - ((v - min) / range) * (h - 12)]);
                  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
                  const last = pts[pts.length - 1];
                  return (
                    <>
                      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="var(--forest)" fillOpacity="0.06" />
                      <path d={line} fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--forest)" />
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </Link>

        {/* Health score — the one Cobalt hero card */}
        <Link href="/free/health-score" className="block rounded-[28px] bg-forest p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[13px] font-medium text-mint">tala health score</span>
            <span className={cn(
              "flex-none rounded-full px-2.5 py-1 text-[12px] font-semibold",
              scoreVal > 0 && scoreVal < 50 ? "bg-sun text-sun-ink" : "bg-field text-forest",
            )}>
              {scoreVal ? scoreStatusText : "Not scored yet"}
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              {score === undefined ? (
                <div className="h-10 w-24 animate-pulse rounded-xl bg-forest-700" />
              ) : (
                <div className="font-display tabular-nums text-[48px] leading-none tracking-[-0.04em] text-paper">
                  {scoreVal || "—"}<span className="text-[18px] text-mint">/100</span>
                </div>
              )}
              <div className="mt-2 text-[13px] text-mint tabular-nums">
                {savingsRate > 0 ? `${savingsRate.toFixed(0)}% savings rate this month` : scoreVal ? "Add this month's budget to sharpen it" : scoreStatusText}
              </div>
            </div>
            <svg width="104" height="58" viewBox="0 0 104 58" className="flex-none" aria-hidden="true">
              <path d="M8 52 A44 44 0 0 1 96 52" fill="none" stroke="var(--track-dark)" strokeWidth="9" strokeLinecap="round" />
              {scoreVal > 0 && (
                <path
                  d="M8 52 A44 44 0 0 1 96 52" fill="none"
                  stroke={scoreVal < 50 ? "var(--sun)" : "var(--field)"} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${arcFill} ${arcLen}`}
                />
              )}
            </svg>
          </div>
        </Link>

        {/* Monthly budget — Budget lives under Home, so this card is its entry point */}
        <Link href="/free/budget" className="flex items-center gap-3.5 rounded-[24px] bg-surface p-3 transition-colors hover:ring-1 hover:ring-green">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[16px] bg-field text-forest">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tala-eyebrow text-ink-40">{monthLabel} budget</div>
            <div className="mt-1 text-[15px] font-semibold text-forest tabular-nums">
              {hasBudget ? (
                <><span className={saved < 0 ? "text-clay-ink" : undefined}>{fmt(saved)}</span> kept · {fmt(income)} in · {fmt(expenses)} out</>
              ) : (
                "Set up this month's budget"
              )}
            </div>
          </div>
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest text-paper">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </div>
        </Link>

        {/* Goals */}
        <section aria-labelledby="home-goals" className="space-y-3 pt-1">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="home-goals" className="font-sans text-[16px] font-semibold text-forest">Goals</h2>
            <Link href="/free/goals" className="text-[14px] font-semibold text-green underline underline-offset-4">See all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {topGoal ? (
              <Link href="/free/goals" className="flex min-w-0 flex-col gap-2.5 rounded-[24px] bg-field p-4">
                <div className="truncate text-[14px] font-semibold text-forest">{topGoal.title}</div>
                <div className="font-display tabular-nums text-[32px] leading-none tracking-[-0.04em] text-forest">
                  {goalPct}<span className="text-[16px]">%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-forest/15">
                  <div className="h-full rounded-full bg-forest" style={{ width: `${goalPct}%` }} />
                </div>
                <span className={cn(
                  "self-start rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  goalStatus === "on_track" || goalStatus === "active" ? "bg-forest text-paper" : "bg-sun-tint text-amber-ink",
                )}>
                  {goalStatus === "on_track" || goalStatus === "active" ? "On track" : goalStatus === "almost" ? "At risk" : "Off track"}
                </span>
              </Link>
            ) : (
              <Link href="/free/goals" className="flex flex-col items-center justify-center gap-2 rounded-[24px] bg-surface p-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-field text-forest">
                  <Target className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="text-[14px] font-semibold text-forest">Set your first goal</div>
              </Link>
            )}

            <Link href="/free/milestones" className="flex min-w-0 flex-col gap-1.5 rounded-[24px] bg-breeze p-4">
              <div className="tala-eyebrow text-forest">Streak</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display tabular-nums text-[32px] leading-none tracking-[-0.04em] text-forest">{streakWeeks}</span>
                <span className="text-[14px] font-semibold text-forest">{streakWeeks === 1 ? "week" : "weeks"}</span>
              </div>
              <div className="mt-auto flex items-center gap-1.5 text-[13px] text-forest">
                <Flame className="h-4 w-4 text-sun-deep" aria-hidden="true" />
                {earnedMilestones.length} {earnedMilestones.length === 1 ? "badge" : "badges"} earned
              </div>
            </Link>
          </div>

          {goals.slice(1, 3).map(g => {
            const target = parseFloat(g.targetAmount ?? "0");
            const pct = target > 0 ? Math.min(100, Math.round((parseFloat(g.currentAmount ?? "0") / target) * 100)) : 0;
            return (
              <Link key={g.id} href="/free/goals" className="flex items-center gap-3 rounded-[20px] bg-surface p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold text-forest">{g.title}</span>
                    <span className="flex-none text-[13px] text-ink-40 tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
                    <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        {/* Achievements strip */}
        <section aria-labelledby="home-achievements" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="home-achievements" className="font-sans text-[16px] font-semibold text-forest">Achievements</h2>
            <Link href="/free/milestones" className="text-[14px] font-semibold text-green underline underline-offset-4">View all</Link>
          </div>
          {earnedMilestones.length === 0 && !newlyEarned && (
            <p className="px-1 text-[13px] text-ink-40 text-pretty">
              {streakWeeks > 0 ? `${streakWeeks}-week streak — keep going to earn your first badge.` : "Check in weekly to start your streak and earn your first badge."}
            </p>
          )}
          <MilestoneChips earnedKeys={earnedMilestones} newlyEarned={newlyEarned} />
        </section>

        {/* This week's insight */}
        <section aria-labelledby="home-insight" className="rounded-[24px] bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div id="home-insight" className="tala-eyebrow text-ink-40">This week's insight</div>
            <button
              onClick={refreshAdvisorTip}
              aria-label="Refresh insight"
              className="-mr-2 -mt-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-40 transition-colors hover:bg-paper hover:text-forest"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <h3 className="text-[16px] font-semibold text-forest">{advisorTip.title}</h3>
          <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-40 text-pretty">{advisorTip.body}</p>
          <button
            type="button"
            onClick={() => handleConversionCtaClick("dashboard_advisor_tip")}
            disabled={manageSubscription.isPending}
            className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubscribed ? "Manage subscription" : "Get an investment plan"}
          </button>
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

        {/* Quick actions */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          {[
            { label: "Update budget", href: "/free/budget", icon: Wallet },
            { label: "Add to a goal", href: "/free/goals", icon: Plus },
          ].map(a => (
            <Link key={a.href} href={a.href} className="inline-flex h-11 flex-none items-center gap-2 rounded-full bg-surface px-4 text-[14px] font-semibold text-forest transition-colors hover:bg-green-tint">
              <a.icon className="h-4 w-4" aria-hidden="true" />{a.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => handleConversionCtaClick("dashboard_quick_actions")}
            disabled={manageSubscription.isPending}
            className="inline-flex h-11 flex-none items-center gap-2 rounded-full bg-field px-4 text-[14px] font-semibold text-forest transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />{isSubscribed ? "Manage plan" : "Get a plan"}
          </button>
        </div>
      </div>

      <BottomSheet isOpen={planPickerOpen} onClose={() => setPlanPickerOpen(false)} title="Choose your plan">
        <PlanPicker />
      </BottomSheet>
    </AppShell>
  );
}
