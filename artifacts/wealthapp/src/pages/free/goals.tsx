import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import FreeTierBanner from "@/components/FreeTierBanner";
import GoalCard, { toGoalCardData } from "@/components/shared/GoalCard";
import LockedGoalSlotCard from "@/components/LockedGoalSlotCard";
import CurrencyField from "@/components/shared/CurrencyField";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { Lock, X, TrendingUp, Plus, Trash2, ChevronDown, Home, Palmtree, ShieldAlert, Rocket, CreditCard, GraduationCap, Plane, Car, Briefcase, Landmark, Target } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { calculateProjection, applyMonthlyGrowth } from "@/lib/goalProjection";
import type { ProjectionResult } from "@/lib/goalProjection";
import { getRatesFromStorage } from "@/lib/milestones";
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
    mutationFn: (body: object) => apiFetch("/goals", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <AppShell>
      <div className="space-y-4 pb-20">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}</div>
      <BottomNav />
    </AppShell>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (goals.length === 0) {
    return (
      <AppShell>
        <div className="pb-20 md:pb-0 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <Target className="w-12 h-12 text-primary" />
          <h2 className="text-xl font-semibold">Set your first financial goal</h2>
          <p className="text-muted-foreground text-sm max-w-xs">A clear goal with a target date is the foundation of every great financial plan.</p>
          <Button onClick={openAddForm}>Add your first goal →</Button>
        </div>

        <AnimatePresence>{showGoalForm && <GoalFormSheet form={goalForm} setForm={setGoalForm} errors={formErrors} editingGoal={editingGoal} onClose={closeGoalForm} onSubmit={submitGoalForm} isBusy={isFormBusy} currency={currency} />}</AnimatePresence>
        <BottomNav />
      </AppShell>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-4">

        <FreeTierBanner
          feature="1-goal limit, manual progress tracking"
          benefit="Investment clients get unlimited advisor-managed goals with auto-synced portfolio progress."
          storageKey="goals"
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, color: "#042C53", letterSpacing: "-0.02em" }}>
              Financial Goals
            </h1>
            <p style={{ fontSize: 12, color: "#A8A095", marginTop: 2 }}>
              {goals.length} {goals.length === 1 ? "goal" : "goals"} active
            </p>
          </div>
          <Button size="sm" onClick={openAddForm} className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" />Add goal
          </Button>
        </div>

        {/* Monthly growth chip */}
        {totalMonthlyGrowth > 0 && topGoal && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">
                +{sym}{Math.round(totalMonthlyGrowth).toLocaleString()}/month growing toward your goals
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {monthlyCashSaved > 0 && `${sym}${Math.round(monthlyCashSaved).toLocaleString()} cash saved`}
                {monthlyCashSaved > 0 && monthlyReturns > 0 && " + "}
                {monthlyReturns > 0 && `${sym}${Math.round(monthlyReturns).toLocaleString()} from returns`}
              </p>
            </div>
          </div>
        )}

        {/* Goal list */}
        {sortedGoals.map((goal) => {
          const proj = goal.id === topGoal?.id ? topGoalProjection : projections.get(goal.id);
          const st = proj?.status ?? goal.status;
          const eyebrowColor = st === "on_track" ? "#1D9E75" : st === "almost" ? "#E8A53C" : "#D86B5A";
          const eyebrowText = st === "on_track" ? "ON TRACK" : st === "almost" ? "AT RISK" : "OFF TRACK";
          const projText = goalProjectionText(goal);
          const isAchieved = parseFloat(goal.currentAmount ?? "0") >= parseFloat(goal.targetAmount ?? "1");

          return (
            <div key={goal.id} className="space-y-2">
              {/* Status eyebrow */}
              {!isAchieved && (
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: eyebrowColor }}>
                  {eyebrowText}
                </p>
              )}

              <GoalCard
                goal={toGoalCardData(goal, st, goal.id === topGoal?.id ? savingsBalance + investmentValue : 0)}
                projection={proj}
                onEdit={() => openEditForm(goal)}
              />

              {/* Projection text line */}
              {projText && (
                <div className="flex items-center gap-2 px-1">
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: eyebrowColor, flexShrink: 0 }} />
                  <p className="text-xs text-muted-foreground">{projText}</p>
                </div>
              )}

              {/* Delete controls */}
              {confirmDeleteId === goal.id ? (
                <div className="flex items-center gap-2 justify-end px-1 pt-1">
                  <span className="text-xs text-muted-foreground">Delete this goal?</span>
                  <button
                    onClick={() => deleteGoalMutation.mutate(goal.id)}
                    disabled={deleteGoalMutation.isPending}
                    className="text-xs text-white font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: "#D86B5A" }}
                  >
                    {deleteGoalMutation.isPending ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-end px-1">
                  <button
                    onClick={() => setConfirmDeleteId(goal.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    aria-label={`Delete goal: ${goal.title}`}
                    style={{ minHeight: 36, padding: "0 8px" }}
                  >
                    <Trash2 className="h-3 w-3" />Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Locked 2nd goal slot — free users at the 1-goal cap */}
        {profile?.role === "free_user" && goals.length >= 1 && <LockedGoalSlotCard />}

        {/* Upgrade CTA — contextual (skip when the locked slot above already carries this message) */}
        {!(profile?.role === "free_user" && goals.length >= 1) && (() => {
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
            <div className="rounded-[20px] p-5" style={{ background: "#F2EFE9", border: "1.5px dashed #D8D2C8" }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "#E6F5EE" }}>
                  <Lock className="h-4 w-4" style={{ color: "#1D9E75" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#042C53", lineHeight: 1.4 }}>{insight}</p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs border-primary text-primary hover:bg-primary/5">
                    Book a free discovery call →
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

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

      <BottomNav />
    </AppShell>
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

function GoalFormSheet({ form, setForm, errors, editingGoal, onClose, onSubmit, isBusy, currency }: GoalFormSheetProps) {
  const formCurrency = form.currency || currency;

  return (
    <>
      <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 p-6 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{editingGoal ? "Edit goal" : "Add a goal"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Goal name</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Emergency fund"
              autoFocus
              className={cn(
                "w-full border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary",
                errors.title ? "border-red-400" : "border-border"
              )}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1 ml-1">{errors.title}</p>}
          </div>

          {/* Goal type */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Goal type</label>
            <div className="relative">
              <select
                value={form.goalType}
                onChange={e => setForm(f => ({ ...f, goalType: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
              >
                {GOAL_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Currency</label>
            <div className="relative">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
              >
                <option value="USD">USD — US Dollar ($)</option>
                <option value="VND">VND — Vietnamese Đồng (₫)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Target amount */}
          <div>
            <CurrencyField editable value={form.targetAmount} onChange={v => setForm(f => ({ ...f, targetAmount: v }))} currency={formCurrency} label="Target amount" />
            {errors.targetAmount && <p className="text-xs text-red-500 mt-1 ml-1">{errors.targetAmount}</p>}
          </div>

          {/* Current amount */}
          <CurrencyField editable value={form.currentAmount} onChange={v => setForm(f => ({ ...f, currentAmount: v }))} currency={formCurrency} label="Amount already saved" />

          {/* Monthly contribution */}
          <CurrencyField editable value={form.monthlyContribution} onChange={v => setForm(f => ({ ...f, monthlyContribution: v }))} currency={formCurrency} label="Monthly contribution" />

          {/* Target date */}
          <div>
            <label className="text-sm font-medium block mb-1.5">Target date</label>
            <input
              type="month"
              value={form.targetDate}
              onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <Button className="w-full mt-6" disabled={isBusy} onClick={onSubmit}>
          {isBusy ? "Saving…" : editingGoal ? "Save changes" : "Add goal"}
        </Button>
      </motion.div>
    </>
  );
}
