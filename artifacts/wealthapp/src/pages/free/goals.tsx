// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Progress-bar width transition, BottomSheet spring animation, goal-tile arrow rotate on expand
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Tailwind default palette (emerald/amber/red/slate/gray/blue) — use tala tokens
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Own bottom nav / back nav / brand header — FreeAppShell owns all navigation

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import FreeTierBanner from "@/components/FreeTierBanner";
import GoalCard, { toGoalCardData } from "@/components/shared/GoalCard";
import LockedGoalSlotCard from "@/components/LockedGoalSlotCard";
import CurrencyField from "@/components/shared/CurrencyField";
import Sol from "@/components/Sol";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { Link } from "wouter";
import { ArrowUpRight, X, Plus, Trash2, ChevronDown, Home, Palmtree, ShieldAlert, Rocket, CreditCard, GraduationCap, Plane, Car, Briefcase, Landmark, Target, Lock, ListOrdered, Trophy, ChartSpline } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { calculateProjection, applyMonthlyGrowth } from "@/lib/goalProjection";
import type { ProjectionResult } from "@/lib/goalProjection";
import { getRatesFromStorage, getEarnedMilestones, MILESTONES } from "@/lib/milestones";
import { openSolChat } from "@/lib/solChat";
import { cn } from "@/lib/utils";

export interface Goal {
  id: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string | null;
  monthlyContribution: string | null;
  currency: string;
  status: string;
  targetDate?: string | null;
}

interface BudgetEntry { income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTransaction { id: string; periodMonth: string; amount: string; type: string; category: string; }
interface Asset { id: string; valueUsd: string; category: string; }

const EXPENSE_KEYS = ["housing", "food", "transport", "utilities", "entertainment", "other"] as const;
const AUTO_UPDATE_STORAGE_KEY = "goal_auto_update_month";

const GOAL_TYPES = [
  { value: "home_purchase",          label: "Home Purchase",           icon: Home },
  { value: "retirement",             label: "Retirement",              icon: Palmtree },
  { value: "emergency_fund",         label: "Emergency Fund",          icon: ShieldAlert },
  { value: "financial_independence", label: "Financial Independence",  icon: Rocket },
  { value: "debt_payoff",            label: "Debt Payoff",             icon: CreditCard },
  { value: "education",              label: "Education",               icon: GraduationCap },
  { value: "travel",                 label: "Travel",                  icon: Plane },
  { value: "vehicle",                label: "Vehicle",                 icon: Car },
  { value: "business",               label: "Business",                icon: Briefcase },
  { value: "investment",             label: "Investment",              icon: Landmark },
  { value: "other",                  label: "Other",                   icon: Target },
];

const STATUS_ORDER: Record<string, number> = { off_track: 0, almost: 1, on_track: 2, achieved: 3 };

type GoalForm = {
  title: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
  currency: string;
};

const defaultGoalForm: GoalForm = {
  title: "",
  goalType: "other",
  targetAmount: 0,
  currentAmount: 0,
  monthlyContribution: 0,
  targetDate: "",
  currency: "USD",
};

function currentNow() { return new Date(); }
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function getLastAutoUpdateMonth(goalId: string): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTO_UPDATE_STORAGE_KEY) ?? "{}") as Record<string, string>;
    return stored[goalId] ?? null;
  } catch { return null; }
}
function setLastAutoUpdateMonth(goalId: string, month: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTO_UPDATE_STORAGE_KEY) ?? "{}") as Record<string, string>;
    stored[goalId] = month;
    localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, JSON.stringify(stored));
  } catch {}
}

function goalProjectionText(goal: Goal): string {
  const current = parseFloat(goal.currentAmount ?? "0");
  const target = parseFloat(goal.targetAmount ?? "0");
  const monthly = parseFloat(goal.monthlyContribution ?? "0");

  if (target > 0 && current >= target) return "";
  if (target <= 0) return "";
  if (monthly <= 0) return "Add a monthly contribution to see your projection";

  const remaining = Math.max(0, target - current);
  const monthsNeeded = Math.ceil(remaining / monthly);
  if (monthsNeeded <= 0) return "";

  const reachDate = new Date();
  reachDate.setMonth(reachDate.getMonth() + monthsNeeded);
  const reachLabel = reachDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const goalSym = goal.currency === "VND" ? "₫" : "$";
  return `At ${goalSym}${monthly.toLocaleString()}/month you'll reach your goal in ${reachLabel}`;
}

export default function GoalsPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";
  const sym = currency === "VND" ? "₫" : "$";

  // Goal form state (shared between add and edit)
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalForm, setGoalForm] = useState<GoalForm>({ ...defaultGoalForm, currency });
  const [formErrors, setFormErrors] = useState<{ title?: string; targetAmount?: string }>({});

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const autoUpdateTriggered = useRef(false);
  const currentMk = monthKey(currentNow());

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch<Goal[]>("/goals"),
  });

  const { data: budgets = [] } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
    retry: false,
  });

  const { data: transactions = [] } = useQuery<BudgetTransaction[]>({
    queryKey: ["budget-transactions", currentMk],
    queryFn: () => apiFetch<BudgetTransaction[]>(`/budget/transactions?month=${currentMk}`),
    retry: false,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<Asset[]>("/assets"),
    retry: false,
  });

  const topGoal = goals[0] ?? null;

  // ── Monthly growth calculation (for topGoal auto-update & growth chip) ───
  const { savingsRate: lsSavRate, investmentRate: lsInvRate } = getRatesFromStorage();
  const savRatePct = profile?.savingsRatePercent ? parseFloat(profile.savingsRatePercent) : lsSavRate;
  const invRatePct = profile?.investmentRatePercent ? parseFloat(profile.investmentRatePercent) : lsInvRate;

  const txIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const txExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const budget = budgets[budgets.length - 1];
  const estIncome = parseFloat(budget?.income ?? "0");
  const estExpenses = EXPENSE_KEYS.reduce((s, k) => s + parseFloat((budget as any)?.[k] ?? "0"), 0);
  const income = txIncome > 0 ? txIncome : estIncome;
  const expenses = txExpenses > 0 ? txExpenses : estExpenses;
  const monthlyCashSaved = Math.max(0, income - expenses);

  const assetsSavings = assets.filter(a => a.category === "savings" || a.category === "cash").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const assetsInvestment = assets.filter(a => a.category === "investment").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const savingsBalance = assetsSavings > 0 ? assetsSavings : parseFloat(profile?.totalSavings ?? "0");
  const investmentValue = assetsInvestment > 0 ? assetsInvestment : parseFloat(profile?.totalInvestments ?? "0");
  const monthlyReturns = savingsBalance * (savRatePct / 100 / 12) + investmentValue * (invRatePct / 100 / 12);
  const totalMonthlyGrowth = monthlyCashSaved + monthlyReturns;

  // ── Per-goal projections (simple: goal's own monthlyContribution only) ────
  const projections = useMemo(() => {
    const map = new Map<string, ProjectionResult>();
    for (const goal of goals) {
      if (!goal.targetDate || !goal.targetAmount) continue;
      const current = parseFloat(goal.currentAmount ?? "0");
      const target = parseFloat(goal.targetAmount);
      if (current >= target) continue;
      const monthly = parseFloat(goal.monthlyContribution ?? "0");
      map.set(goal.id, calculateProjection({
        currentAmount: current,
        targetAmount: target,
        targetDate: goal.targetDate,
        monthlyCashSaved: monthly,
        savingsBalance: 0,
        savingsRatePercent: 0,
        investmentValue: 0,
        investmentRatePercent: 0,
      }));
    }
    return map;
  }, [goals]);

  // Sort: off_track → almost → on_track → achieved
  const sortedGoals = useMemo(() =>
    [...goals].sort((a, b) => {
      const sa = projections.get(a.id)?.status ?? a.status;
      const sb = projections.get(b.id)?.status ?? b.status;
      return (STATUS_ORDER[sa] ?? 1) - (STATUS_ORDER[sb] ?? 1);
    }), [goals, projections]);

  // ── Complex projection for topGoal (monthly growth chip context) ──────────
  const effectiveCurrentAmount = parseFloat(topGoal?.currentAmount ?? "0") + savingsBalance + investmentValue;
  const topGoalProjection = useMemo(() => {
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
  }, [topGoal?.id, topGoal?.currentAmount, topGoal?.targetAmount, topGoal?.targetDate, effectiveCurrentAmount, monthlyCashSaved, savingsBalance, investmentValue, savRatePct, invRatePct]);

  // ── Monthly auto-update (topGoal only, runs 1st of each month) ───────────
  const autoUpdateGoal = useMutation({
    mutationFn: ({ goalId, newCurrentAmount }: { goalId: string; newCurrentAmount: number }) =>
      apiFetch<Goal>("/goals/auto-update", { method: "POST", body: JSON.stringify({ goalId, newCurrentAmount }) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["goals"], (prev: Goal[] | undefined) =>
        (prev ?? []).map(g => g.id === updated.id ? { ...g, currentAmount: updated.currentAmount } : g),
      );
      toast.success(
        `Monthly update applied — +${sym}${Math.round(totalMonthlyGrowth).toLocaleString()} from savings & returns`,
        { duration: 4000 },
      );
    },
  });

  useEffect(() => {
    if (!topGoal || autoUpdateTriggered.current) return;
    if (!budgets.length && !transactions.length && !assets.length) return;
    const todayDate = currentNow();
    const currentMonth = monthKey(todayDate);
    const lastMonth = getLastAutoUpdateMonth(topGoal.id);
    if (lastMonth === currentMonth) return;
    const isFirstOfMonth = todayDate.getDate() === 1;
    if (!isFirstOfMonth && lastMonth !== null) return;
    if (totalMonthlyGrowth <= 0) return;
    autoUpdateTriggered.current = true;
    setLastAutoUpdateMonth(topGoal.id, currentMonth);
    const currentAmt = parseFloat(topGoal.currentAmount ?? "0");
    const targetAmt = parseFloat(topGoal.targetAmount ?? "0");
    const rawNew = applyMonthlyGrowth(currentAmt, monthlyCashSaved, savingsBalance, savRatePct, investmentValue, invRatePct);
    const newAmount = targetAmt > 0 ? Math.min(targetAmt, rawNew) : rawNew;
    autoUpdateGoal.mutate({ goalId: topGoal.id, newCurrentAmount: newAmount });
  }, [topGoal?.id, budgets.length, transactions.length, assets.length, totalMonthlyGrowth]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const addGoalMutation = useMutation({
    mutationFn: (body: { goalType: string; currency: string }) => apiFetch("/goals", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      track("goal_created", { goalType: variables.goalType, currency: variables.currency });
      toast.success("Goal added!");
      closeGoalForm();
    },
    onError: () => toast.error("Failed to add goal"),
  });

  const editGoalMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch(`/goals/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["health-score"] });
      toast.success("Goal updated!");
      closeGoalForm();
    },
    onError: () => toast.error("Failed to update goal"),
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setConfirmDeleteId(null);
      toast.success("Goal deleted");
    },
    onError: () => toast.error("Failed to delete goal"),
  });

  // ── Form helpers ──────────────────────────────────────────────────────────
  function openAddForm() {
    setGoalForm({ ...defaultGoalForm, currency });
    setFormErrors({});
    setEditingGoal(null);
    setShowGoalForm(true);
  }

  function openEditForm(goal: Goal) {
    setGoalForm({
      title: goal.title,
      goalType: goal.goalType ?? "other",
      targetAmount: parseFloat(goal.targetAmount ?? "0"),
      currentAmount: parseFloat(goal.currentAmount ?? "0"),
      monthlyContribution: parseFloat(goal.monthlyContribution ?? "0"),
      targetDate: goal.targetDate ? goal.targetDate.slice(0, 7) : "",
      currency: goal.currency ?? "USD",
    });
    setFormErrors({});
    setEditingGoal(goal);
    setShowGoalForm(true);
  }

  function closeGoalForm() {
    setShowGoalForm(false);
    setEditingGoal(null);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const errors: { title?: string; targetAmount?: string } = {};
    if (!goalForm.title.trim()) errors.title = "Title is required";
    if (goalForm.targetAmount <= 0) {
      errors.targetAmount = "Target amount must be greater than 0";
    } else if (goalForm.currentAmount >= goalForm.targetAmount) {
      errors.targetAmount = "Target must be greater than current amount";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submitGoalForm() {
    if (!validateForm()) return;
    const body = {
      title: goalForm.title.trim(),
      goalType: goalForm.goalType,
      targetAmount: String(goalForm.targetAmount),
      currentAmount: String(goalForm.currentAmount),
      monthlyContribution: String(goalForm.monthlyContribution),
      targetDate: goalForm.targetDate ? goalForm.targetDate + "-01" : null,
      currency: goalForm.currency,
    };
    if (editingGoal) {
      editGoalMutation.mutate({ id: editingGoal.id, body });
    } else {
      addGoalMutation.mutate(body);
    }
  }

  const isFormBusy = addGoalMutation.isPending || editGoalMutation.isPending;

  // ── Contribute sheet ──────────────────────────────────────────────────────
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const contributeMutation = useMutation({
    mutationFn: ({ id, currentAmount }: { id: string; currentAmount: number }) =>
      apiFetch(`/goals/${id}`, { method: "PUT", body: JSON.stringify({ currentAmount: String(currentAmount) }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["health-score"] });
      toast.success("Contribution added");
      setContributeGoal(null);
    },
    onError: () => toast.error("Failed to add contribution"),
  });

  // ── "Plan ahead" tile counts (same pathway query + milestone store the tabs read) ──
  const { data: pathwaySteps = [] } = useQuery<{ stepNumber: number; status: string }[]>({
    queryKey: ["pathway"],
    queryFn: () => apiFetch<{ stepNumber: number; status: string }[]>("/pathway"),
    retry: false,
  });
  const pathwayDone = Math.min(6, pathwaySteps.filter(s => s.status === "completed").length);
  const [earnedBadges, setEarnedBadges] = useState(0);
  useEffect(() => { setEarnedBadges(getEarnedMilestones().length); }, []);

  const isFreeAtCap = profile?.role === "free_user" && goals.length >= 1;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <AppShell>
      <div className="space-y-4 pb-8">
        <div className="h-10 w-48 bg-surface animate-pulse rounded-full" />
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-44 bg-surface animate-pulse rounded-[28px]" />)}
      </div>
    </AppShell>
  );

  const newGoalButton = isFreeAtCap ? (
    <Link
      href="/free/advisor"
      onClick={() => track("upgrade_cta_clicked", { location: "goals_new_goal" })}
      className="h-11 shrink-0 rounded-full bg-surface px-[18px] inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest transition-opacity hover:opacity-90"
    >
      <Lock className="h-4 w-4" aria-hidden="true" />New goal
    </Link>
  ) : (
    <button
      type="button"
      onClick={openAddForm}
      className="h-11 shrink-0 rounded-full bg-surface px-[18px] inline-flex items-center gap-1.5 text-[14px] font-semibold text-forest transition-opacity hover:opacity-90"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />New goal
    </button>
  );

  const pageHeader = (headline: string, sub?: string | null) => (
    <header className="flex flex-col gap-3.5 px-1 pt-1 pb-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="tala-eyebrow text-ink-40">Goals</span>
        {newGoalButton}
      </div>
      <div>
        <h1 className="font-display text-[36px] leading-[1.05] text-forest text-balance">{headline}</h1>
        {sub && <p className="text-[14px] text-ink-40 leading-[1.5] mt-2 text-pretty tabular-nums">{sub}</p>}
      </div>
    </header>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (goals.length === 0) {
    return (
      <AppShell>
        <div className="space-y-3.5 pb-8">
          {pageHeader("Pick one thing to save toward", "Give it an amount and a date, and we'll show you the pace that gets you there.")}
          <div className="bg-field rounded-[28px] p-5 flex flex-col gap-3 text-forest">
            <div className="w-11 h-11 rounded-[14px] bg-paper flex items-center justify-center">
              <Target className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="font-sans text-[17px] font-semibold">Set your first financial goal</h2>
            <p className="text-[14px] leading-[1.5] text-pretty">
              A clear goal with a target date is the foundation of every great financial plan.
            </p>
            <button
              onClick={openAddForm}
              className="self-start h-11 px-5 rounded-full bg-forest text-paper text-[14px] font-semibold transition-opacity hover:opacity-90"
            >
              Add your first goal
            </button>
          </div>
        </div>

        <AnimatePresence>{showGoalForm && <GoalFormSheet form={goalForm} setForm={setGoalForm} errors={formErrors} editingGoal={editingGoal} onClose={closeGoalForm} onSubmit={submitGoalForm} isBusy={isFormBusy} currency={currency} />}</AnimatePresence>
      </AppShell>
    );
  }

  // Sol's one observation, from the same numbers the top goal card shows.
  const topStatus = topGoal ? (topGoalProjection?.status ?? topGoal.status) : null;
  const topCard = topGoal && topStatus ? toGoalCardData(topGoal, topStatus, savingsBalance + investmentValue) : null;
  const solLine = topCard && topCard.targetAmountNum
    ? `${topCard.title} sits at ${topCard.progressPct}% of ${sym}${Math.round(topCard.targetAmountNum).toLocaleString()}${topGoalProjection?.monthsRemaining ? `, with ${topGoalProjection.monthsRemaining} months to cover the rest` : ""}.`
    : null;

  // Headline summarises pacing across every goal.
  const statuses = sortedGoals.map(g => (g.id === topGoal?.id ? topGoalProjection : projections.get(g.id))?.status ?? g.status);
  const attentionCount = statuses.filter(s => s === "off_track" || s === "almost").length;
  const one = goals.length === 1;
  const headline = attentionCount > 0
    ? (one ? "Your goal needs attention" : `${attentionCount} of your goals need attention`)
    : statuses.every(s => s === "achieved")
    ? (one ? "You reached your goal" : "You reached your goals")
    : statuses.some(s => s === "on_track")
    ? (one ? "Your goal is on track" : "Your goals are on track")
    : (one ? "Your goal is set" : "Your goals are set");

  // Cash cushion, from the same savings balance and monthly spending used above.
  const cushionMonths = expenses > 0 && savingsBalance > 0 ? savingsBalance / expenses : 0;

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="flex flex-col gap-3.5 pb-8">

        {pageHeader(headline, solLine)}

        {/* Goal list — full-colour tiles; tap to open the projection block */}
        {sortedGoals.map((goal) => {
          const proj = goal.id === topGoal?.id ? topGoalProjection : projections.get(goal.id);
          const st = proj?.status ?? goal.status;
          const projText = goalProjectionText(goal);

          return (
            <div key={goal.id} className="flex flex-col gap-1.5">
              <GoalCard
                goal={toGoalCardData(goal, st, goal.id === topGoal?.id ? savingsBalance + investmentValue : 0)}
                projection={proj}
                defaultExpanded={false}
                onEdit={() => openEditForm(goal)}
                onContribute={() => setContributeGoal(goal)}
              />

              <div className="flex items-center justify-between gap-3 px-1">
                {projText ? (
                  <p className="text-[13px] text-ink-40 leading-[1.4] text-pretty min-w-0">{projText}</p>
                ) : <span />}

                {/* Delete controls */}
                {confirmDeleteId === goal.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] text-ink-40 hidden sm:inline">Delete this goal?</span>
                    <button
                      onClick={() => deleteGoalMutation.mutate(goal.id)}
                      disabled={deleteGoalMutation.isPending}
                      className="h-11 px-4 rounded-full bg-clay text-paper text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {deleteGoalMutation.isPending ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="h-11 px-4 rounded-full border-[1.5px] border-hairline-2 text-forest text-[13px] font-semibold transition-opacity hover:opacity-90"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(goal.id)}
                    className="shrink-0 min-h-11 px-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-40 hover:text-clay-ink transition-colors"
                    aria-label={`Delete goal: ${goal.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Locked 2nd goal slot — free users at the 1-goal cap */}
        {isFreeAtCap && <LockedGoalSlotCard />}

        {/* Cash cushion — Sunset "worth a look" tile */}
        {cushionMonths > 0 && (
          <section aria-label="Emergency fund" className="bg-sun rounded-[28px] p-5 flex flex-col gap-2.5 text-forest">
            <span className="tala-eyebrow">Worth a look</span>
            <span className="text-[22px] font-semibold tabular-nums">{cushionMonths.toFixed(1)} months</span>
            <p className="text-[15px] leading-[1.45] text-pretty">
              of spending saved as cash.{" "}
              {cushionMonths >= 6
                ? "Many people aim for 6 — you're there, so new savings could go to your goal."
                : cushionMonths >= 3
                ? "Many people aim for 3 to 6 months — you're within that range."
                : "Many people aim for 3 to 6 months before saving hard for other goals."}
            </p>
            <button
              type="button"
              onClick={openSolChat}
              className="self-start mt-1 h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
            >
              Ask Sol why
            </button>
          </section>
        )}

        {/* Upgrade CTA — only when the locked slot above isn't already carrying it */}
        {!isFreeAtCap && (() => {
          const offTrackGoal = sortedGoals.find(g => {
            const p = g.id === topGoal?.id ? topGoalProjection : projections.get(g.id);
            return (p?.status ?? g.status) === "off_track";
          });
          const offTrackProj = offTrackGoal ? (offTrackGoal.id === topGoal?.id ? topGoalProjection : projections.get(offTrackGoal.id)) : null;
          const insight = offTrackGoal && offTrackProj?.monthlyShortfall && offTrackProj.monthlyShortfall > 0
            ? `Your ${offTrackGoal.title} is short by ${sym}${Math.round(offTrackProj.monthlyShortfall).toLocaleString()}/month. An advisor can build an investment plan to close the gap.`
            : sortedGoals.length >= 2
            ? `You have ${sortedGoals.length} active goals — an advisor can build a unified strategy across all of them.`
            : topGoal
            ? `An advisor can create a personalised investment roadmap for ${topGoal.title}.`
            : "An advisor can help you build a personalised financial plan.";
          return (
            <div className="bg-breeze rounded-[24px] p-4 flex gap-3 text-forest">
              <div className="shrink-0"><Sol size="sm" animate="breathe" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold leading-[1.4] text-pretty">{insight}</p>
                <Link
                  href="/free/advisor"
                  className="mt-3 inline-flex items-center gap-1.5 h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
                >
                  Meet an advisor <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          );
        })()}

        {!isFreeAtCap && <FreeTierBanner
          feature="1-goal limit, manual progress tracking"
          benefit="Investment clients get unlimited advisor-managed goals with auto-synced portfolio progress."
          storageKey="goals"
        />}

        {/* Plan ahead — Pathway + Milestones tabs, locked What-if */}
        <section aria-label="Plan ahead" className="flex flex-col gap-3 pt-1.5">
          <h2 className="font-sans text-[16px] font-semibold text-forest px-1">Plan ahead</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/free/pathway" className="bg-field rounded-[24px] p-4 min-h-[140px] flex flex-col justify-between gap-5 text-forest transition-opacity hover:opacity-90">
              <ListOrdered className="h-8 w-8" strokeWidth={1.8} aria-hidden="true" />
              <span className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold">My pathway</span>
                <span className="text-[13px] tabular-nums">{pathwayDone} of 6 steps done</span>
              </span>
            </Link>
            <Link href="/free/milestones" className="bg-breeze rounded-[24px] p-4 min-h-[140px] flex flex-col justify-between gap-5 text-forest transition-opacity hover:opacity-90">
              <Trophy className="h-8 w-8" strokeWidth={1.8} aria-hidden="true" />
              <span className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold">Milestones</span>
                <span className="text-[13px] tabular-nums">{earnedBadges} of {MILESTONES.length} badges</span>
              </span>
            </Link>
            <Link
              href="/free/advisor"
              onClick={() => track("upgrade_cta_clicked", { location: "goals_what_if" })}
              className="col-span-2 bg-surface rounded-[24px] p-4 flex items-center gap-3.5 text-forest transition-opacity hover:opacity-90"
            >
              <ChartSpline className="h-8 w-8 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="text-[16px] font-semibold">What-if</span>
                <span className="text-[13px] text-ink-40">Try changes first · with an advisor</span>
              </span>
              <Lock className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      {/* Add / Edit goal sheet */}
      <AnimatePresence>
        {showGoalForm && (
          <GoalFormSheet
            form={goalForm}
            setForm={setGoalForm}
            errors={formErrors}
            editingGoal={editingGoal}
            onClose={closeGoalForm}
            onSubmit={submitGoalForm}
            isBusy={isFormBusy}
            currency={currency}
          />
        )}
      </AnimatePresence>

      {/* Add-a-contribution sheet */}
      <AnimatePresence>
        {contributeGoal && (
          <ContributeSheet
            goal={contributeGoal}
            onClose={() => setContributeGoal(null)}
            isBusy={contributeMutation.isPending}
            onSubmit={(amount) => contributeMutation.mutate({
              id: contributeGoal.id,
              currentAmount: parseFloat(contributeGoal.currentAmount ?? "0") + amount,
            })}
          />
        )}
      </AnimatePresence>

    </AppShell>
  );
}

// ── Contribute bottom sheet ───────────────────────────────────────────────────
function ContributeSheet({ goal, onClose, onSubmit, isBusy }: { goal: Goal; onClose: () => void; onSubmit: (amount: number) => void; isBusy: boolean }) {
  const [amount, setAmount] = useState(0);
  return (
    <>
      <motion.div className="fixed inset-0 bg-forest-900/40 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-paper rounded-t-[28px] z-50 px-5 pt-3 pb-10 shadow-[0_-8px_28px_rgba(12,33,164,0.12)] max-h-[92vh] overflow-y-auto md:max-w-lg md:mx-auto"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline-2" aria-hidden="true" />
        <div className="flex items-center justify-between mb-5">
          <div className="min-w-0">
            <div className="tala-eyebrow text-ink-40">Add a contribution</div>
            <h3 className="text-[18px] font-semibold text-forest truncate mt-1">{goal.title}</h3>
          </div>
          <button onClick={onClose} className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-surface text-forest transition-opacity hover:opacity-80" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <CurrencyField editable value={amount} onChange={setAmount} currency={goal.currency || "USD"} label="Amount you've put aside" />
        <button
          type="button"
          className="w-full h-11 mt-6 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={isBusy || amount <= 0}
          onClick={() => onSubmit(amount)}
        >
          {isBusy ? "Saving…" : "Add contribution"}
        </button>
      </motion.div>
    </>
  );
}

// ── Goal form bottom sheet ────────────────────────────────────────────────────
interface GoalFormSheetProps {
  form: GoalForm;
  setForm: React.Dispatch<React.SetStateAction<GoalForm>>;
  errors: { title?: string; targetAmount?: string };
  editingGoal: Goal | null;
  onClose: () => void;
  onSubmit: () => void;
  isBusy: boolean;
  currency: string;
}

const FIELD_LABEL = "text-[13px] font-semibold text-forest block mb-1.5";
const FIELD_INPUT = "w-full h-11 rounded-2xl bg-surface px-4 text-[14px] text-forest border outline-none transition-colors focus:border-green";

function GoalFormSheet({ form, setForm, errors, editingGoal, onClose, onSubmit, isBusy, currency }: GoalFormSheetProps) {
  const formCurrency = form.currency || currency;

  return (
    <>
      <motion.div className="fixed inset-0 bg-forest-900/40 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-paper rounded-t-[28px] z-50 px-5 pt-3 pb-10 shadow-[0_-8px_28px_rgba(12,33,164,0.12)] max-h-[92vh] overflow-y-auto md:max-w-lg md:mx-auto"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline-2" aria-hidden="true" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[18px] font-semibold text-forest">{editingGoal ? "Edit goal" : "Add a goal"}</h3>
          <button onClick={onClose} className="h-11 w-11 flex items-center justify-center rounded-full bg-surface text-forest transition-opacity hover:opacity-80" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className={FIELD_LABEL}>Goal name</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Emergency fund"
              autoFocus
              className={cn(FIELD_INPUT, "placeholder:text-ink-30", errors.title ? "border-clay" : "border-hairline-2")}
            />
            {errors.title && <p className="text-[12px] text-clay-ink mt-1 ml-1">{errors.title}</p>}
          </div>

          {/* Goal type */}
          <div>
            <label className={FIELD_LABEL}>Goal type</label>
            <div className="relative">
              <select
                value={form.goalType}
                onChange={e => setForm(f => ({ ...f, goalType: e.target.value }))}
                className={cn(FIELD_INPUT, "border-hairline-2 appearance-none pr-10")}
              >
                {GOAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-40 pointer-events-none" />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className={FIELD_LABEL}>Currency</label>
            <div className="relative">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className={cn(FIELD_INPUT, "border-hairline-2 appearance-none pr-10")}
              >
                <option value="USD">USD — US Dollar ($)</option>
                <option value="VND">VND — Vietnamese Đồng (₫)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-40 pointer-events-none" />
            </div>
          </div>

          {/* Target amount */}
          <div>
            <CurrencyField editable value={form.targetAmount} onChange={v => setForm(f => ({ ...f, targetAmount: v }))} currency={formCurrency} label="Target amount" />
            {errors.targetAmount && <p className="text-[12px] text-clay-ink mt-1 ml-1">{errors.targetAmount}</p>}
          </div>

          {/* Current amount */}
          <CurrencyField editable value={form.currentAmount} onChange={v => setForm(f => ({ ...f, currentAmount: v }))} currency={formCurrency} label="Amount already saved" />

          {/* Monthly contribution */}
          <CurrencyField editable value={form.monthlyContribution} onChange={v => setForm(f => ({ ...f, monthlyContribution: v }))} currency={formCurrency} label="Monthly contribution" />

          {/* Target date */}
          <div>
            <label className={FIELD_LABEL}>Target date</label>
            <input
              type="month"
              value={form.targetDate}
              onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
              className={cn(FIELD_INPUT, "border-hairline-2")}
            />
          </div>
        </div>

        <button
          type="button"
          className="w-full h-11 mt-6 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={isBusy}
          onClick={onSubmit}
        >
          {isBusy ? "Saving…" : editingGoal ? "Save changes" : "Add goal"}
        </button>
      </motion.div>
    </>
  );
}
