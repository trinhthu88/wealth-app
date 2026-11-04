// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: Ring stroke draw-in and sub-score bar width transitions
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav or bottom padding hacks — FreeAppShell owns the menu bar

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
import { RefreshCw, TrendingUp, ShieldAlert, CreditCard, Landmark, ArrowUpRight } from "lucide-react";
import SolNarration from "@/components/client/SolNarration";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
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

// Status pills: Spring Field = good, Blue Breeze = fair, Sunset tint only for
// "needs work" (attention).
type Badge = { label: string; pill: string };
const GOOD: Badge = { label: "Good",       pill: "bg-field text-forest" };
const FAIR: Badge = { label: "Fair",       pill: "bg-breeze text-forest" };
const WORK: Badge = { label: "Needs work", pill: "bg-sun-tint text-amber-ink" };

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function insightCardClass(text: string): string {
  if (/on track|ahead|positive|grew|great|excellent/i.test(text)) return "bg-green-tint";
  return "bg-surface";
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
      icon: TrendingUp,
      score: srScore,
      badge: srBadge,
      detail: effectiveSavingsRate > 0 ? `${Math.round(effectiveSavingsRate)}% of income saved` : "No income data yet",
      tip: srTip,
      actionLabel: "Update my budget",
      actionRoute: "/free/budget",
    },
    {
      label: "Emergency fund",
      icon: ShieldAlert,
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
      icon: CreditCard,
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
      label: "Investment activity",
      icon: Landmark,
      score: invScore,
      badge: invBadge,
      detail: investmentBalance > 0
        ? `${sym}${Math.round(investmentBalance).toLocaleString()} invested`
        : "Not started yet",
      tip: invTip,
      actionLabel: "Talk to an advisor about investing",
      actionRoute: "/book",
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

  const chartData = history.length > 1
    ? history.map(h => ({ score: h.overallScore, date: h.scoreDate }))
    : null;

  // ── Ring status + Sol line ────────────────────────────────────────────────
  const statusText = overall >= 85 ? "Excellent" : overall >= 70 ? "Good shape" : overall >= 50 ? "Getting there" : overall >= 30 ? "Needs work" : overall > 0 ? "Action needed" : "Calculating...";
  const statusPill = overall >= 70 ? "bg-field text-forest" : overall >= 40 ? "bg-breeze text-forest" : overall > 0 ? "bg-sun text-forest" : "bg-forest-700 text-paper";

  const weakest = dimensions.reduce((low, d) => (d.score < low.score ? d : low), dimensions[0]);
  const solLine = !score
    ? "Your score is being worked out from your budget, savings, debt and investments."
    : weakest.score >= 70
    ? `All four parts of your score are in good shape — ${overall} out of 100 overall.`
    : `Your score is ${overall}. ${weakest.label} is the part holding it back most right now.`;
  const solDetail = weakest.tip ?? "Your score blends savings rate, emergency fund, debt load and investing. It updates when you edit your plan, budget or asset data.";

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || (!score && calculate.isPending)) return (
    <AppShell>
      <div className="space-y-4 pb-8">
        <div className="h-72 bg-surface animate-pulse rounded-[28px]" />
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-surface animate-pulse rounded-[24px]" />)}
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="pb-8 space-y-4">

        <SolNarration line={solLine} detail={solDetail} />

        <div>
          <h1 className="font-display text-[30px] leading-[1.1] text-forest">Health score</h1>
          <p className="text-[14px] text-ink-40 leading-[1.5] mt-1.5 text-pretty">
            How your savings, safety net, debt and investing add up today.
          </p>
        </div>

        {/* ── Hero ring (Cobalt) ───────────────────────────────────────── */}
        <div className="bg-forest rounded-[28px] p-6 flex flex-col items-center text-center">
          <div className="tala-eyebrow text-mint mb-4">Your score · out of 100</div>
          <HealthScoreRing score={overall} size="lg" darkMode />
          <span className={cn("mt-4 inline-block rounded-full px-3 py-1 text-[12px] font-semibold", statusPill)}>
            {statusText}
          </span>
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 h-11 rounded-full bg-forest-700 px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
            onClick={() => calculate.mutate()} disabled={calculate.isPending}
            aria-label="Recalculate financial health score"
          >
            <RefreshCw className={cn("h-4 w-4", calculate.isPending && "animate-spin")} aria-hidden="true" />
            {calculate.isPending ? "Calculating…" : "Recalculate"}
          </button>
          <p className="text-[12px] text-mint mt-3 text-pretty">Updates when you edit your plan, budget, or asset data</p>
        </div>

        {/* ── Four sub-scores ──────────────────────────────────────────── */}
        {score && (
          <section className="space-y-3">
            <h2 className="font-sans text-[16px] font-semibold text-forest">What makes up your score</h2>
            {dimensions.map((dim) => {
              const badge = dim.badge;
              const barPct = Math.min(100, dim.score);
              const fill = dim.score < 40 ? "bg-sun" : "bg-forest";
              return (
                <div key={dim.label} className="bg-surface rounded-[24px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-paper text-forest flex-none flex items-center justify-center" aria-hidden="true">
                      <dim.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-forest leading-[1.3]">{dim.label}</h3>
                      <p className="text-[13px] text-ink-40 mt-0.5">{dim.detail}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-none">
                      <span className="font-display tabular-nums text-[24px] leading-none text-forest">{dim.score}</span>
                      <span className={cn("text-[11px] font-semibold rounded-full px-2 py-0.5", badge.pill)}>{badge.label}</span>
                    </div>
                  </div>
                  <div
                    className="mt-4 h-2 rounded-full bg-track overflow-hidden"
                    role="progressbar"
                    aria-valuenow={barPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${dim.label}: ${dim.score} out of 100, ${badge.label}`}
                  >
                    <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fill)} style={{ width: `${barPct}%` }} />
                  </div>

                  {/* Inline tip for scores below 70, always paired with a next-step action */}
                  {dim.tip && (
                    <div className="mt-4 rounded-[16px] bg-paper p-4">
                      <p className="text-[14px] text-ink-40 leading-[1.5] text-pretty">{dim.tip}</p>
                      <Link
                        href={dim.actionRoute}
                        className="inline-flex items-center gap-2 min-h-11 text-[14px] font-semibold text-green"
                      >
                        {dim.actionLabel}
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* ── What would improve this — one clear next action ─────────────── */}
        {score && (
          <section>
            <h2 className="font-sans text-[16px] font-semibold text-forest mb-3">What would improve this</h2>
            <WeeklyTipCard tip={weeklyTip} />
          </section>
        )}

        {/* ── Personalised insights ──────────────────────────────────────── */}
        {score && insights.length > 0 && (
          <section>
            <h2 className="font-sans text-[16px] font-semibold text-forest mb-3">Personalised insights</h2>
            <div className="space-y-3">
              {insights.map((text, i) => (
                <div key={i} className={cn("rounded-[24px] p-4 text-[14px] leading-[1.5] text-forest text-pretty", insightCardClass(text))}>
                  {text}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Peer benchmark (only when age is known) ─────────────────────── */}
        {score && profileAge != null && (effectiveSavingsRate > 0 || overall > 0) && (
          <BenchmarkCard
            userSavingsRate={effectiveSavingsRate}
            userHealthScore={overall}
            age={profileAge}
          />
        )}

        {/* ── Score history ─────────────────────────────────────────────── */}
        <section>
          <h2 className="font-sans text-[16px] font-semibold text-forest mb-3">Score history</h2>
          {chartData ? (
            <div className="bg-surface rounded-[24px] p-5">
              <div role="img" aria-label={`Health score history: latest score ${chartData[chartData.length - 1]?.score ?? "unavailable"} out of 100`}>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={chartData}>
                    <Tooltip formatter={(v) => [`${v}`, "Score"]} labelFormatter={(l) => new Date(l).toLocaleDateString("en-US", { month: "short" })} />
                    <Line type="monotone" dataKey="score" stroke="var(--forest)" strokeWidth={2} dot={{ fill: "var(--forest)", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-[24px] p-5 text-center">
              <p className="text-[14px] text-ink-40">Check back next month to see your score trend</p>
            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
}
