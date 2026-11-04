// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Ring stroke draw-in (HealthScoreRing) and history bar height transitions
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav, own back button or bottom padding hacks — FreeAppShell owns the menu bar and back pill

import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import HealthScoreRing from "@/components/shared/HealthScoreRing";
import BenchmarkCard from "@/components/BenchmarkCard";
import WeeklyTipCard from "@/components/WeeklyTipCard";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { RefreshCw, ArrowUp, ArrowDown, ArrowUpRight, Check, Lightbulb } from "lucide-react";
import Sol from "@/components/Sol";
import { cn } from "@/lib/utils";
import { openSolChat } from "@/lib/solChat";
import { useProfile } from "@/hooks/useProfile";
import { generateWeeklyTip, getAgeBenchmarkSavingsRate } from "@/lib/tipEngine";
import { getStreak, getRatesFromStorage } from "@/lib/milestones";
import { calculateProjection } from "@/lib/goalProjection";

interface HealthScore {
  overallScore: number;
  budgetScore: number;
  goalsScore: number;
  netWorthScore: number | null;
  savingsScore: number;
  scoreDate: string;
  insights: Record<string, unknown> | null;
}
interface Pathway { stepNumber: number; status: string; }
interface Goal { id: string; title: string; status: string; targetAmount: string | null; currentAmount: string | null; targetDate?: string | null; }
interface BudgetEntry { income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTx { id: string; periodMonth: string; amount: string; type: string; }
interface AssetItem { id: string; valueUsd: string; category: string; }
interface Liability { id: string; balanceUsd: string; }

const EXPENSE_KEYS = ["housing", "food", "transport", "utilities", "entertainment", "other"] as const;

// ── Dimension scoring helpers ─────────────────────────────────────────────
function savingsRateScore(rate: number): number {
  if (rate >= 20) return 100;
  if (rate >= 15) return 80;
  if (rate >= 10) return 60;
  if (rate >= 5)  return 40;
  if (rate >  0)  return 20;
  return 0;
}

function emergencyFundScore(months: number): number {
  if (months >= 6) return 100;
  if (months >= 3) return 70;
  if (months >= 1) return 40;
  if (months >  0) return 20;
  return 0;
}

function debtLoadScore(totalDebt: number, annualIncome: number): number {
  if (totalDebt <= 0) return 100;
  if (annualIncome <= 0) return 50;
  const ratio = totalDebt / annualIncome;
  if (ratio <= 0.5) return 90;
  if (ratio <= 1.0) return 75;
  if (ratio <= 2.0) return 55;
  if (ratio <= 3.0) return 35;
  return 15;
}

function investmentScore(investmentBalance: number): number {
  if (investmentBalance > 50_000) return 100;
  if (investmentBalance > 20_000) return 85;
  if (investmentBalance > 10_000) return 70;
  if (investmentBalance > 5_000)  return 55;
  if (investmentBalance > 1_000)  return 35;
  if (investmentBalance > 0)      return 20;
  return 0;
}

// Status labels (read out with each sub-score tile).
type Badge = { label: string };
const GOOD: Badge = { label: "Good" };
const FAIR: Badge = { label: "Fair" };
const WORK: Badge = { label: "Needs work" };

// Sub-score tile colour (approved design): full-strength Spring Field ≥70,
// Blue Breeze 50–69, Sunset Pop <50. Text stays Cobalt on all three.
function tileTone(score: number): string {
  if (score >= 70) return "bg-field";
  if (score >= 50) return "bg-breeze";
  return "bg-sun";
}

// Page title from the score band.
function bandTitle(score: number, hasScore: boolean): string {
  if (!hasScore) return "Your health score";
  if (score >= 85) return "In great shape";
  if (score >= 70) return "In good shape";
  if (score >= 50) return "Getting there";
  if (score >= 30) return "Needs some work";
  return "Needs attention";
}

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function isPositiveInsight(text: string): boolean {
  return /on track|ahead|positive|grew|great|excellent/i.test(text);
}

function monthShort(dateStr: string): string {
  const d = new Date(dateStr.length <= 10 ? `${dateStr.slice(0, 10)}T00:00:00` : dateStr);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short" });
}

export default function HealthScorePage() {
  const { profile } = useProfile();
  const sym = (profile?.preferredCurrency ?? "USD") === "VND" ? "₫" : "$";
  const currentMk = monthKey(new Date());

  const [streakWeeks, setStreakWeeks] = useState(0);
  useEffect(() => { setStreakWeeks(getStreak().weeks); }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: score, isLoading } = useQuery<HealthScore>({
    queryKey: ["health-score"],
    queryFn: () => apiFetch<HealthScore>("/health-score"),
    retry: false,
  });

  const { data: history = [] } = useQuery<HealthScore[]>({
    queryKey: ["health-score-history"],
    queryFn: () => apiFetch<HealthScore[]>("/health-score/history").catch(() => []),
    retry: false,
  });

  const { data: pathway = [] } = useQuery<Pathway[]>({
    queryKey: ["pathway"],
    queryFn: () => apiFetch<Pathway[]>("/pathway"),
    retry: false,
  });

  const { data: budgets = [] } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
    retry: false,
  });

  const { data: transactions = [] } = useQuery<BudgetTx[]>({
    queryKey: ["budget-transactions", currentMk],
    queryFn: () => apiFetch<BudgetTx[]>(`/budget/transactions?month=${currentMk}`),
    retry: false,
  });

  const { data: assets = [] } = useQuery<AssetItem[]>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<AssetItem[]>("/assets"),
    retry: false,
  });

  const { data: liabilities = [] } = useQuery<Liability[]>({
    queryKey: ["liabilities"],
    queryFn: () => apiFetch<Liability[]>("/liabilities"),
    retry: false,
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch<Goal[]>("/goals"),
    retry: false,
  });

  const calculate = useMutation({
    mutationFn: () => apiFetch<HealthScore>("/health-score", { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData(["health-score"], data);
      // Invalidate live data queries so dimension scores refresh from current DB state
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["budget-transactions", currentMk] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["health-score-history"] });
      track("health_score_calculated", { score: data.overallScore });
      toast.success("Health score updated!");
    },
    onError: () => toast.error("Failed to calculate score"),
  });

  // Auto-calculate if no score yet
  useEffect(() => {
    if (!isLoading && !score && !calculate.isPending) {
      calculate.mutate();
    }
  }, [isLoading, score]);

  // ── Derived values ────────────────────────────────────────────────────────
  const overall = score?.overallScore ?? 0;

  // Income / expenses — always from live budget/transaction data (never from pathway)
  const txIncome  = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const txExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const budget = budgets[budgets.length - 1];
  const estIncome   = parseFloat(budget?.income ?? "0");
  const estExpenses = EXPENSE_KEYS.reduce((s, k) => s + parseFloat((budget as any)?.[k] ?? "0"), 0);
  const income   = txIncome   > 0 ? txIncome   : estIncome;
  const expenses = txExpenses > 0 ? txExpenses : estExpenses;

  // Savings balance: cash + savings categories (both count toward emergency fund)
  const assetsSavings    = assets.filter(a => a.category === "savings" || a.category === "cash").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const assetsInvestment = assets.filter(a => a.category === "investment").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const savingsBalance    = assetsSavings    > 0 ? assetsSavings    : parseFloat(profile?.totalSavings    ?? "0");
  const investmentBalance = assetsInvestment > 0 ? assetsInvestment : parseFloat(profile?.totalInvestments ?? "0");
  const totalDebt = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd ?? "0"), 0);
  const annualIncome = income * 12;

  // Effective savings rate computed from live income/expenses — not from stored insights
  const liveMonthlySaved = Math.max(0, income - expenses);
  const effectiveSavingsRate = income > 0 ? (liveMonthlySaved / income) * 100 : 0;

  // ── Four dimension scores ─────────────────────────────────────────────────
  const emergencyMonths = expenses > 0 ? savingsBalance / expenses : 0;
  const debtToIncome = annualIncome > 0 ? totalDebt / annualIncome : 0;
  const srScore  = savingsRateScore(effectiveSavingsRate);
  const efScore  = emergencyFundScore(emergencyMonths);
  const dlScore  = debtLoadScore(totalDebt, annualIncome);
  const invScore = investmentScore(investmentBalance);

  // ── Per-dimension status badges (using underlying data thresholds, not score %) ──
  const srBadge: Badge  = effectiveSavingsRate >= 15 ? GOOD : effectiveSavingsRate >= 8 ? FAIR : WORK;
  const efBadge: Badge  = emergencyMonths >= 6 ? GOOD : emergencyMonths >= 3 ? FAIR : WORK;
  const dlBadge: Badge  = debtToIncome <= 0 ? GOOD : debtToIncome < 0.5 ? GOOD : debtToIncome < 1.5 ? FAIR : WORK;
  const invBadge: Badge = investmentBalance > 10_000 ? GOOD : investmentBalance > 1_000 ? FAIR : WORK;

  // Tips (shown only when score < 70)
  const srTip: string | null = srScore < 70
    ? (effectiveSavingsRate < 10
        ? `Try increasing your monthly savings by just ${sym}50 — small amounts compound significantly over time.`
        : `You're saving at ${Math.round(effectiveSavingsRate)}% — pushing to 20% would maximize your savings score.`)
    : null;

  const efTip: string | null = efScore < 70
    ? `Aim to build 3 months of expenses (${sym}${Math.round(expenses * 3).toLocaleString()} based on your budget) as your emergency fund.`
    : null;

  const dlTip: string | null = dlScore < 70
    ? "Your debt payments are above 30% of income. Focus extra payments on your highest-interest debt first."
    : null;

  const invTip: string | null = invScore < 70
    ? (investmentBalance <= 0
        ? `You're not yet investing. Even ${sym}100/month in an index fund grows significantly over 10 years.`
        : `You have investments but they're below your income level. Increasing monthly contributions will boost this score.`)
    : null;

  const dimensions = [
    {
      label: "Savings rate",
      score: srScore,
      badge: srBadge,
      detail: effectiveSavingsRate > 0 ? `${Math.round(effectiveSavingsRate)}% of income saved` : "No income data yet",
      tip: srTip,
      actionLabel: "Update my budget",
      actionRoute: "/free/budget",
    },
    {
      label: "Safety net",
      score: efScore,
      badge: efBadge,
      detail: emergencyMonths >= 0.1
        ? `${emergencyMonths.toFixed(1)} months covered`
        : savingsBalance > 0 ? `${sym}${Math.round(savingsBalance).toLocaleString()} saved` : "Build yours now",
      tip: efTip,
      actionLabel: "Set an Emergency Fund goal",
      actionRoute: "/free/goals",
    },
    {
      label: "Debt load",
      score: dlScore,
      badge: dlBadge,
      detail: totalDebt > 0
        ? `${sym}${Math.round(totalDebt).toLocaleString()} total debt`
        : "Debt-free",
      tip: dlTip,
      actionLabel: "Update my budget",
      actionRoute: "/free/budget",
    },
    {
      label: "Investing",
      score: invScore,
      badge: invBadge,
      detail: investmentBalance > 0
        ? `${sym}${Math.round(investmentBalance).toLocaleString()} invested`
        : "Not started yet",
      tip: invTip,
      actionLabel: "Talk to an advisor",
      actionRoute: "/free/advisor",
    },
  ];

  // Profile age (stored as (profile as any).age from pathway step 1)
  const profileAge = (profile as any)?.age as number | null | undefined ?? null;

  // ── "What would improve this" — one prioritized next action, reusing the same
  // tip engine the dashboard uses for its weekly insight (not shown here today).
  const { savingsRate: lsSavRate, investmentRate: lsInvRate } = getRatesFromStorage();
  const savRatePct = profile?.savingsRatePercent ? parseFloat(profile.savingsRatePercent) : lsSavRate;
  const invRatePct = profile?.investmentRatePercent ? parseFloat(profile.investmentRatePercent) : lsInvRate;
  const benchmarkSavingsRate = getAgeBenchmarkSavingsRate(profileAge ?? null);
  const topGoal = goals[0] ?? null;
  const goalCurrentAmount = parseFloat(topGoal?.currentAmount ?? "0") + savingsBalance + investmentBalance;

  const projection = useMemo(() => {
    if (!topGoal?.targetDate || !topGoal.targetAmount) return undefined;
    return calculateProjection({
      currentAmount: goalCurrentAmount,
      targetAmount: parseFloat(topGoal.targetAmount ?? "0"),
      targetDate: topGoal.targetDate,
      monthlyCashSaved: liveMonthlySaved,
      savingsBalance,
      savingsRatePercent: savRatePct,
      investmentValue: investmentBalance,
      investmentRatePercent: invRatePct,
    });
  }, [topGoal, goalCurrentAmount, savingsBalance, investmentBalance, savRatePct, invRatePct]);

  const goalStatus = projection?.status ?? topGoal?.status ?? "on_track";

  const weeklyTip = useMemo(() => generateWeeklyTip({
    effectiveSavingsRate,
    healthScore: overall,
    goal: topGoal ? { title: topGoal.title, monthlyShortfall: projection?.monthlyShortfall } : null,
    goalStatus,
    ageBenchmarkSavingsRate: benchmarkSavingsRate,
    streakWeeks,
    isExpat: profile?.isExpat ?? false,
    investmentRatePercent: invRatePct,
  }), [effectiveSavingsRate, overall, topGoal, goalStatus, projection, benchmarkSavingsRate, streakWeeks, profile?.isExpat, invRatePct]);

  // Personalised insights from API
  const insights = (() => {
    if (!score?.insights) return [];
    const raw = score.insights as Record<string, unknown>;
    const out: string[] = [];
    const sr    = typeof raw.effectiveSavingsRate === "number" ? raw.effectiveSavingsRate : 0;
    const steps = typeof raw.completedSteps       === "number" ? raw.completedSteps       : 0;
    const onTrk = typeof raw.goalsOnTrack         === "number" ? raw.goalsOnTrack         : 0;
    const wgr   = typeof raw.wealthGrowthRate     === "number" ? raw.wealthGrowthRate     : 0;
    if (sr > 0) out.push(`Your effective savings rate is ${sr.toFixed(0)}% — ${sr >= 20 ? "excellent, you're in the top tier!" : sr >= 10 ? "consider pushing to 20% for maximum score" : "try reaching 10% as the first milestone"}`);
    out.push(`You've completed ${steps} of 6 plan steps — ${steps >= 5 ? "almost there!" : steps >= 3 ? "keep going, each step boosts your score" : "complete more steps to improve your score"}`);
    out.push(`${onTrk} goal${onTrk !== 1 ? "s" : ""} on track — ${onTrk > 0 ? "great progress! Stay consistent." : "set a goal with a target date to unlock 25 more points"}`);
    if (wgr > 0) out.push(`Wealth growing at ${wgr.toFixed(1)}%/year — ${wgr >= 10 ? "excellent growth rate!" : wgr >= 5 ? "solid, keep investing" : "consider increasing your investment allocation"}`);
    return out;
  })();

  // ── History: latest score per month, oldest → newest, last 3 months ──────
  const monthlyHistory = useMemo(() => {
    const byMonth = new Map<string, HealthScore>();
    [...history]
      .filter(h => typeof h.scoreDate === "string" && h.scoreDate.length >= 7)
      .sort((a, b) => a.scoreDate.localeCompare(b.scoreDate))
      .forEach(h => byMonth.set(h.scoreDate.slice(0, 7), h));
    return Array.from(byMonth.values()).slice(-3);
  }, [history]);

  // Change chip: today's score vs the latest score from an earlier month.
  const scoreMonth = score?.scoreDate?.slice(0, 7) ?? currentMk;
  const previous = [...monthlyHistory].reverse().find(h => h.scoreDate.slice(0, 7) < scoreMonth) ?? null;
  const change = score && previous ? Math.round(overall - previous.overallScore) : null;
  const sinceMonth = previous ? monthShort(previous.scoreDate) : "";

  // ── Sol line ──────────────────────────────────────────────────────────────
  const weakest = dimensions.reduce((low, d) => (d.score < low.score ? d : low), dimensions[0]);
  const allGood = weakest.score >= 70;
  const solLine = !score
    ? "Your score is being worked out from your budget, savings, debt and investments."
    : allGood
    ? `All four parts of your score are in good shape — ${overall} out of 100 overall.`
    : `${weakest.label} is the part pulling your score down most.`;
  const solDetail = weakest.tip ?? "Your score blends savings rate, safety net, debt and investing. It updates when you edit your plan, budget or asset data.";

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || (!score && calculate.isPending)) return (
    <AppShell>
      <div className="space-y-[14px] pb-8">
        <div className="h-20 bg-surface animate-pulse rounded-[24px]" />
        <div className="h-[172px] bg-surface animate-pulse rounded-[28px]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-surface animate-pulse rounded-[24px]" />)}
        </div>
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="space-y-[14px] pb-8">

        {/* ── Title from the score band ─────────────────────────────────── */}
        <div className="px-1 pt-1">
          <h1 className="font-display text-[36px] leading-[1.05] text-forest text-balance">{bandTitle(overall, !!score)}</h1>
          <p className="mt-1 text-[14px] leading-[1.5] text-ink-40 text-pretty">
            How saving, safety net, debt and investing add up
          </p>
        </div>

        {/* ── Hero (Cobalt) — ring + change chip ────────────────────────── */}
        <section aria-label="Your score" className="flex items-center gap-[18px] rounded-[28px] bg-forest p-5 text-paper">
          <HealthScoreRing score={overall} size="lg" darkMode />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <span className="tala-eyebrow text-mint">Out of 100</span>
            {change !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-field px-3 py-1.5 text-[12px] font-semibold text-forest whitespace-nowrap">
                {change > 0 && <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
                {change < 0 && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
                {change === 0
                  ? `Same as ${sinceMonth}`
                  : <><span className="sr-only">{change > 0 ? "Up" : "Down"}</span>{Math.abs(change)} since {sinceMonth}</>}
              </span>
            )}
            <span className="text-[13px] leading-[1.45] text-mint text-pretty">
              Updates when you change your budget, goal or net worth.
            </span>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-paper/80 px-4 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
              onClick={() => calculate.mutate()} disabled={calculate.isPending}
              aria-label="Recalculate financial health score"
            >
              <RefreshCw className={cn("h-4 w-4", calculate.isPending && "animate-spin")} aria-hidden="true" />
              {calculate.isPending ? "Calculating…" : "Recalculate"}
            </button>
          </div>
        </section>

        {/* ── Four sub-scores (2×2) ─────────────────────────────────────── */}
        {score && (
          <section aria-label="What makes up your score" className="space-y-2.5">
            <h2 className="font-sans text-[16px] font-semibold text-forest px-1 pt-1">What makes it up</h2>
            <div className="grid grid-cols-2 gap-3">
              {dimensions.map(dim => (
                <div
                  key={dim.label}
                  className={cn("flex flex-col gap-1.5 rounded-[24px] p-4 text-forest", tileTone(dim.score))}
                  aria-label={`${dim.label}: ${dim.score} out of 100, ${dim.badge.label}. ${dim.detail}`}
                  role="group"
                >
                  <span className="font-display tabular-nums text-[34px] leading-none tracking-[-0.03em]" aria-hidden="true">{dim.score}</span>
                  <span className="text-[14px] font-semibold" aria-hidden="true">{dim.label}</span>
                  <span className="text-[13px] leading-[1.4] text-pretty" aria-hidden="true">{dim.detail}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Sol tip ───────────────────────────────────────────────────── */}
        <section aria-label="Sol" className="flex items-start gap-3 rounded-[24px] bg-breeze p-4 text-forest">
          <Sol size="sm" animate="breathe" />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[14px] font-semibold leading-[1.5] text-pretty">{solLine}</p>
            <p className="text-[13px] leading-[1.5] text-pretty">{solDetail}</p>
            {score && !allGood ? (
              <Link
                href={weakest.actionRoute}
                className="inline-flex h-11 items-center gap-1.5 self-start rounded-full bg-forest px-4 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90"
              >
                {weakest.actionLabel}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : score ? (
              <button
                type="button"
                onClick={openSolChat}
                className="inline-flex h-11 items-center self-start rounded-full bg-forest px-4 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90"
              >
                Ask Sol
              </button>
            ) : null}
          </div>
        </section>

        {/* ── Score history (bars) ──────────────────────────────────────── */}
        <section aria-label="Score history" className="flex flex-col gap-2.5 rounded-[24px] bg-surface p-4">
          <h2 className="font-sans text-[16px] font-semibold text-forest">
            {monthlyHistory.length > 1 ? `Last ${monthlyHistory.length} months` : "Score history"}
          </h2>
          {monthlyHistory.length > 1 ? (
            <div
              className="flex h-[112px] items-end gap-2.5"
              role="img"
              aria-label={`Health score by month: ${monthlyHistory.map(h => `${monthShort(h.scoreDate)} ${Math.round(h.overallScore)}`).join(", ")}`}
            >
              {monthlyHistory.map((h, i) => {
                const latest = i === monthlyHistory.length - 1;
                const pct = Math.max(6, Math.min(100, h.overallScore));
                return (
                  <div key={h.scoreDate} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" aria-hidden="true">
                    <span className="text-[13px] font-semibold tabular-nums text-forest">{Math.round(h.overallScore)}</span>
                    <span
                      className={cn("w-full rounded-[10px] transition-[height] duration-500 ease-out", latest ? "bg-forest" : "bg-breeze")}
                      style={{ height: `${(pct / 100) * 64}px` }}
                    />
                    <span className="text-[12px] text-ink-40">{monthShort(h.scoreDate)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[14px] leading-[1.5] text-ink-40 text-pretty">Check back next month to see your score trend.</p>
          )}
        </section>

        {/* ── This week's tip — one clear next action ───────────────────── */}
        {score && (
          <section aria-label="This week's tip" className="space-y-2.5">
            <h2 className="font-sans text-[16px] font-semibold text-forest px-1 pt-1">What would improve this</h2>
            <WeeklyTipCard tip={weeklyTip} />
          </section>
        )}

        {/* ── Personalised insights ─────────────────────────────────────── */}
        {score && insights.length > 0 && (
          <section aria-label="Personalised insights" className="space-y-2.5">
            <h2 className="font-sans text-[16px] font-semibold text-forest px-1 pt-1">Personalised insights</h2>
            <div className="flex flex-col rounded-[24px] bg-surface p-1">
              {insights.map((text, i) => {
                const positive = isPositiveInsight(text);
                return (
                  <div key={i} className="flex items-center gap-3 border-b border-hairline p-3 last:border-0">
                    <span
                      className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-[12px] text-forest", positive ? "bg-field" : "bg-paper")}
                      aria-hidden="true"
                    >
                      {positive ? <Check className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                    </span>
                    <p className="min-w-0 flex-1 text-[14px] leading-[1.45] text-forest text-pretty">{text}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Peer benchmark (only when age is known) ───────────────────── */}
        {score && profileAge != null && (effectiveSavingsRate > 0 || overall > 0) && (
          <BenchmarkCard
            userSavingsRate={effectiveSavingsRate}
            userHealthScore={overall}
            age={profileAge}
          />
        )}

      </div>
    </AppShell>
  );
}
