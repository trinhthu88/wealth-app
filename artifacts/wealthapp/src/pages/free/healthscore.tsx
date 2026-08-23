import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import HealthScoreRing from "@/components/shared/HealthScoreRing";
import BenchmarkCard from "@/components/BenchmarkCard";
import BottomNav from "@/components/BottomNav";
import WeeklyTipCard from "@/components/WeeklyTipCard";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, ShieldAlert, CreditCard, Landmark } from "lucide-react";
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

function statusBadge(score: number) {
  if (score >= 70) return { label: "Good",       color: "#1D9E75", bg: "#E6F5EE" };
  if (score >= 40) return { label: "Fair",       color: "#E8A53C", bg: "#FEF3C7" };
  return             { label: "Needs work", color: "#D86B5A", bg: "#FEEAE8" };
}

function ringColor(score: number): string {
  if (score >= 85) return "#10B981";
  if (score >= 70) return "#1D9E75";
  if (score >= 50) return "#F59E0B";
  if (score >   0) return "#EF4444";
  return "#E6F5EE";
}

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function insightCardStyle(text: string): { background: string; border: string } {
  if (/on track|ahead|positive|grew|great|excellent/i.test(text))
    return { background: "#E6F5EE", border: "1px solid rgba(29,158,117,0.25)" };
  if (/setting|unlock|attention|focus|shortfall/i.test(text))
    return { background: "#FEF9ED", border: "1px solid rgba(245,185,71,0.35)" };
  return { background: "#EFF6FF", border: "1px solid rgba(59,130,246,0.2)" };
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
  const srBadge  = effectiveSavingsRate >= 15 ? { label: "Good",       color: "#1D9E75", bg: "#E6F5EE" }
                 : effectiveSavingsRate >= 8  ? { label: "Fair",       color: "#E8A53C", bg: "#FEF3C7" }
                 :                              { label: "Needs work", color: "#D86B5A", bg: "#FEEAE8" };
  const efBadge  = emergencyMonths >= 6 ? { label: "Good",       color: "#1D9E75", bg: "#E6F5EE" }
                 : emergencyMonths >= 3 ? { label: "Fair",       color: "#E8A53C", bg: "#FEF3C7" }
                 :                        { label: "Needs work", color: "#D86B5A", bg: "#FEEAE8" };
  const dlBadge  = debtToIncome <= 0   ? { label: "Good",       color: "#1D9E75", bg: "#E6F5EE" }
                 : debtToIncome < 0.5  ? { label: "Good",       color: "#1D9E75", bg: "#E6F5EE" }
                 : debtToIncome < 1.5  ? { label: "Fair",       color: "#E8A53C", bg: "#FEF3C7" }
                 :                       { label: "Needs work", color: "#D86B5A", bg: "#FEEAE8" };
  const invBadge = investmentBalance > 10_000 ? { label: "Good",       color: "#1D9E75", bg: "#E6F5EE" }
                 : investmentBalance > 1_000  ? { label: "Fair",       color: "#E8A53C", bg: "#FEF3C7" }
                 :                              { label: "Needs work", color: "#D86B5A", bg: "#FEEAE8" };

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

  // ── Ring drawing values ───────────────────────────────────────────────────
  const statusText = overall >= 85 ? "Excellent" : overall >= 70 ? "Good shape" : overall >= 50 ? "Getting there" : overall >= 30 ? "Needs work" : overall > 0 ? "Action needed" : "Calculating...";
  const statusColor = ringColor(overall);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || (!score && calculate.isPending)) return (
    <AppShell>
      <div className="space-y-4 pb-20">
        <div className="h-52 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}</div>
        <div className="h-32 bg-muted animate-pulse rounded-2xl" />
      </div>
      <BottomNav />
    </AppShell>
  );

  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-5">

        {/* ── Hero ring ──────────────────────────────────────────────────── */}
        <motion.div
          className="bg-white rounded-[20px] p-6 text-center"
          style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col items-center gap-2 mb-2">
            <HealthScoreRing score={overall} size="lg" />
            <div
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: 2.5, color: "#A8A095" }}
            >
              /100
            </div>
            <div
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: statusColor }}
            >
              {statusText}
            </div>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-full transition-colors"
            style={{ border: "1.5px solid #E6E1D8", padding: "9px 18px", fontSize: 13, fontWeight: 500, color: "#6B6459", background: "white", minHeight: 44 }}
            onClick={() => calculate.mutate()} disabled={calculate.isPending}
            aria-label="Recalculate financial health score"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", calculate.isPending && "animate-spin")} />
            {calculate.isPending ? "Calculating…" : "Recalculate"}
          </button>
          <p style={{ fontSize: 11, color: "#A8A095", marginTop: 8 }}>Updates when you edit your plan, budget, or asset data</p>
        </motion.div>

        {/* ── Four dimension cards ────────────────────────────────────────── */}
        {score && (
          <div className="space-y-3">
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#A8A095", margin: 0 }}>
              YOUR FINANCIAL HEALTH
            </h2>
            {dimensions.map((dim) => {
              const badge = dim.badge;
              const barPct = Math.min(100, dim.score);
              const barColor = dim.score >= 70 ? "#1D9E75" : dim.score >= 40 ? "#E8A53C" : "#D86B5A";
              return (
                <div key={dim.label}>
                  <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 8px rgba(15,23,42,0.05)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                          style={{ background: badge.bg, color: badge.color }} aria-hidden="true">
                          <dim.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#2D2A24" }}>{dim.label}</p>
                          <p style={{ fontSize: 11, color: "#A8A095", marginTop: 1 }}>{dim.detail}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: badge.color }}>
                          {dim.score}
                        </span>
                        <span
                          style={{ fontSize: 10, fontWeight: 600, color: badge.color, background: badge.bg, borderRadius: 999, padding: "2px 8px" }}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{ height: 6, borderRadius: 999, background: "#F2EFE9", overflow: "hidden" }}
                      role="progressbar"
                      aria-valuenow={barPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${dim.label}: ${dim.score} out of 100, ${badge.label}`}
                    >
                      <div style={{ height: "100%", borderRadius: 999, background: barColor, width: `${barPct}%`, transition: "width 0.6s ease" }} />
                    </div>
                  </div>

                  {/* Inline tip for scores below 70 */}
                  {dim.tip && (
                    <div className="mt-1.5 mx-1 rounded-xl px-3 py-2.5 flex items-start gap-2"
                      style={{ background: "#FEF9ED", border: "1px solid #F5D88A" }}>
                      <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }} aria-hidden="true"></span>
                      <p style={{ fontSize: 12, color: "#7A5A00", lineHeight: 1.5 }}>{dim.tip}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── What would improve this — one clear next action ─────────────── */}
        {score && (
          <div>
            <h2 className="text-xs font-medium text-muted-foreground mb-3">What would improve this</h2>
            <WeeklyTipCard tip={weeklyTip} />
          </div>
        )}

        {/* ── Personalised insights ──────────────────────────────────────── */}
        {score && insights.length > 0 && (
          <div>
            <h2 className="text-xs font-medium text-muted-foreground mb-3">Personalised insights</h2>
            <div className="space-y-2">
              {insights.map((text, i) => {
                const cardStyle = insightCardStyle(text);
                return (
                  <div key={i} className="rounded-xl p-4" style={{ background: cardStyle.background, border: cardStyle.border, fontSize: 13, lineHeight: 1.55, color: "#2D2A24" }}>
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
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
        <div>
          <h2 className="text-xs font-medium text-muted-foreground mb-3">Score history</h2>
          {chartData ? (
            <div className="bg-card border border-card-border rounded-2xl p-4">
              <div role="img" aria-label={`Health score history: latest score ${chartData[chartData.length - 1]?.score ?? "unavailable"} out of 100`}>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={chartData}>
                    <Tooltip formatter={(v) => [`${v}`, "Score"]} labelFormatter={(l) => new Date(l).toLocaleDateString("en-US", { month: "short" })} />
                    <Line type="monotone" dataKey="score" stroke="#1D9E75" strokeWidth={2} dot={{ fill: "#1D9E75", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-2xl p-5 text-center">
              <p className="text-muted-foreground text-sm">Check back next month to see your score trend</p>
            </div>
          )}
        </div>

      </div>
      <BottomNav />
    </AppShell>
  );
}
