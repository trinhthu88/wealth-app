import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import GoalCard, { type Goal } from "@/components/GoalCard";
import CurrencyInput from "@/components/CurrencyInput";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { Lock, X, TrendingUp } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Link } from "wouter";
import { calculateProjection, applyMonthlyGrowth } from "@/lib/goalProjection";
import { getRatesFromStorage } from "@/lib/milestones";

interface BudgetEntry { income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTransaction { id: string; periodMonth: string; amount: string; type: string; category: string; }
interface Asset { id: string; valueUsd: string; category: string; }

const EXPENSE_KEYS = ["housing", "food", "transport", "utilities", "entertainment", "other"] as const;
const AUTO_UPDATE_STORAGE_KEY = "goal_auto_update_month";

function now() { return new Date(); }
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

export default function GoalsPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";
  const sym = currency === "VND" ? "₫" : "$";

  const [contributeOpen, setContributeOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTarget, setEditTarget] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editMonthly, setEditMonthly] = useState(0);
  const autoUpdateTriggered = useRef(false);

  const currentMk = monthKey(now());

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch<Goal[]>("/goals"),
  });

  const { data: budgets = [] } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
    retry: false,
  });

  // Fetch this month's actual transactions for accurate income/expense calculation
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

  const { savingsRate: lsSavRate, investmentRate: lsInvRate } = getRatesFromStorage();
  const savRatePct = profile?.savingsRatePercent ? parseFloat(profile.savingsRatePercent) : lsSavRate;
  const invRatePct = profile?.investmentRatePercent ? parseFloat(profile.investmentRatePercent) : lsInvRate;

  // Income/expense: prefer real transactions, fall back to estimates
  const txIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const txExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);

  const budget = budgets[budgets.length - 1];
  const estIncome = parseFloat(budget?.income ?? "0");
  const estExpenses = EXPENSE_KEYS.reduce((s, k) => s + parseFloat((budget as any)?.[k] ?? "0"), 0);

  const income = txIncome > 0 ? txIncome : estIncome;
  const expenses = txExpenses > 0 ? txExpenses : estExpenses;
  const monthlyCashSaved = Math.max(0, income - expenses);

  // Prefer categorised asset rows; fall back to profile totals (set via pathway)
  const assetsSavings = assets.filter(a => a.category === "savings").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const assetsInvestment = assets.filter(a => a.category === "investment").reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const savingsBalance = assetsSavings > 0 ? assetsSavings : parseFloat(profile?.totalSavings ?? "0");
  const investmentValue = assetsInvestment > 0 ? assetsInvestment : parseFloat(profile?.totalInvestments ?? "0");

  const monthlyReturns = savingsBalance * (savRatePct / 100 / 12) + investmentValue * (invRatePct / 100 / 12);
  const totalMonthlyGrowth = monthlyCashSaved + monthlyReturns;

  const projection = useMemo(() => {
    if (!topGoal?.targetDate || !topGoal.targetAmount) return undefined;
    return calculateProjection({
      currentAmount: parseFloat(topGoal.currentAmount ?? "0"),
      targetAmount: parseFloat(topGoal.targetAmount ?? "0"),
      targetDate: topGoal.targetDate,
      monthlyCashSaved,
      savingsBalance,
      savingsRatePercent: savRatePct,
      investmentValue,
      investmentRatePercent: invRatePct,
    });
  }, [topGoal?.id, topGoal?.currentAmount, topGoal?.targetAmount, topGoal?.targetDate, monthlyCashSaved, savingsBalance, investmentValue, savRatePct, invRatePct]);

  // ── Monthly auto-update: apply growth from savings + investments ─────────
  // Runs once per month on the 1st (or on first-ever visit with no record).
  const autoUpdateGoal = useMutation({
    mutationFn: ({ goalId, newCurrentAmount }: { goalId: string; newCurrentAmount: number }) =>
      apiFetch<Goal>("/goals/auto-update", { method: "POST", body: JSON.stringify({ goalId, newCurrentAmount }) }),
    onSuccess: (updated) => {
      const prevProjection = projection;
      queryClient.setQueryData(["goals"], (prev: Goal[] | undefined) =>
        (prev ?? []).map(g => g.id === updated.id ? { ...g, currentAmount: updated.currentAmount } : g),
      );

      // Recalculate projection with new amount to detect status change
      if (topGoal?.targetDate && topGoal.targetAmount) {
        const newProjection = calculateProjection({
          currentAmount: parseFloat(updated.currentAmount ?? "0"),
          targetAmount: parseFloat(topGoal.targetAmount ?? "0"),
          targetDate: topGoal.targetDate,
          monthlyCashSaved,
          savingsBalance,
          savingsRatePercent: savRatePct,
          investmentValue,
          investmentRatePercent: invRatePct,
        });

        if (prevProjection && prevProjection.status !== newProjection.status) {
          const improved = newProjection.status === "on_track" ||
            (newProjection.status === "almost" && prevProjection.status === "off_track");
          apiFetch("/notifications", {
            method: "POST",
            body: JSON.stringify({
              type: "goal_status_change",
              title: improved ? "Goal back on track!" : "Goal status updated",
              message: improved
                ? `"${topGoal.title}" is now ${newProjection.status.replace("_", " ")} — your savings & investments are growing!`
                : `"${topGoal.title}" has shifted to ${newProjection.status.replace("_", " ")} — consider boosting your contributions.`,
              link: "/free/goals",
            }),
          }).catch(() => {});
        }
      }

      toast.success(
        `Monthly update applied — +${sym}${Math.round(totalMonthlyGrowth).toLocaleString()} added from savings & returns`,
        { duration: 4000 },
      );
    },
  });

  useEffect(() => {
    if (!topGoal || autoUpdateTriggered.current) return;
    if (!budgets.length && !transactions.length && !assets.length) return;

    const todayDate = now();
    const currentMonth = monthKey(todayDate);
    const lastMonth = getLastAutoUpdateMonth(topGoal.id);

    // Skip if already updated this month
    if (lastMonth === currentMonth) return;

    // Only run on the 1st of the month — unless this is the first-ever update (no record)
    const isFirstOfMonth = todayDate.getDate() === 1;
    if (!isFirstOfMonth && lastMonth !== null) return;

    if (totalMonthlyGrowth <= 0) return;

    autoUpdateTriggered.current = true;
    setLastAutoUpdateMonth(topGoal.id, currentMonth);

    const currentAmt = parseFloat(topGoal.currentAmount ?? "0");
    const targetAmt = parseFloat(topGoal.targetAmount ?? "0");

    // Exact formula: old + monthly_cash_saved + (savings_bal × rate%/12) + (invest_val × rate%/12)
    const rawNew = applyMonthlyGrowth(
      currentAmt,
      monthlyCashSaved,
      savingsBalance,
      savRatePct,
      investmentValue,
      invRatePct,
    );
    const newAmount = targetAmt > 0 ? Math.min(targetAmt, rawNew) : rawNew;
    autoUpdateGoal.mutate({ goalId: topGoal.id, newCurrentAmount: newAmount });
  }, [topGoal?.id, budgets.length, transactions.length, assets.length, totalMonthlyGrowth]);

  const addContribution = useMutation({
    mutationFn: (goal: Goal) => {
      const newAmount = parseFloat(goal.currentAmount ?? "0") + amount;
      return apiFetch(`/goals/${goal.id}`, { method: "PUT", body: JSON.stringify({ currentAmount: String(newAmount) }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Contribution added! 🎯");
      setContributeOpen(false);
      setAmount(0);
      setNote("");
    },
    onError: () => toast.error("Failed to save contribution"),
  });

  const editGoal = useMutation({
    mutationFn: (goal: Goal) =>
      apiFetch(`/goals/${goal.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: editTitle, targetAmount: String(editTarget), targetDate: editDate || null, monthlyContribution: String(editMonthly) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["health-score"] });
      toast.success("Goal updated!");
      setEditOpen(false);
    },
    onError: () => toast.error("Failed to update goal"),
  });

  function openEdit(goal: Goal) {
    setEditTitle(goal.title);
    setEditTarget(parseFloat(goal.targetAmount ?? "0"));
    setEditDate(goal.targetDate ?? "");
    setEditMonthly(parseFloat(goal.monthlyContribution ?? "0"));
    setEditOpen(true);
  }

  if (isLoading) return (
    <AppShell>
      <div className="space-y-4 pb-20">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}</div>
      <BottomNav />
    </AppShell>
  );

  if (goals.length === 0) {
    return (
      <AppShell>
        <div className="pb-20 md:pb-0 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <span className="text-5xl">🎯</span>
          <h2 className="text-xl font-semibold">Set your first financial goal</h2>
          <p className="text-muted-foreground text-sm max-w-xs">A clear goal with a target date is the foundation of every great financial plan.</p>
          <Link href="/free/pathway"><Button>Set a goal in 2 minutes →</Button></Link>
        </div>
        <BottomNav />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-4">
        <div className="px-0.5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Financial Goals</h1>
            <p className="text-sm text-muted-foreground">Free plan · 1 goal</p>
          </div>
          {topGoal && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openEdit(topGoal)}>Edit goal</Button>
          )}
        </div>

        {/* Monthly growth chip */}
        {totalMonthlyGrowth > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">
                +{sym}{Math.round(totalMonthlyGrowth).toLocaleString()}/month growing toward this goal
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {monthlyCashSaved > 0 && `${sym}${Math.round(monthlyCashSaved).toLocaleString()} cash saved`}
                {monthlyCashSaved > 0 && monthlyReturns > 0 && " + "}
                {monthlyReturns > 0 && `${sym}${Math.round(monthlyReturns).toLocaleString()} from returns`}
              </p>
            </div>
          </div>
        )}

        {/* Goal card with on-track / off-track projection */}
        {topGoal && (
          <GoalCard
            goal={topGoal}
            projection={projection}
            onContribute={() => setContributeOpen(true)}
            onEdit={() => openEdit(topGoal)}
          />
        )}

        {/* No budget/savings data notice */}
        {topGoal && !projection && topGoal.targetDate && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-sm font-medium text-amber-800">Add income & savings data to see on-track status</p>
            <p className="text-xs text-amber-700 mt-1">
              <Link href="/free/budget"><span className="underline">Log your income →</span></Link> then{" "}
              <Link href="/free/pathway?step=5"><span className="underline">add your savings & investments →</span></Link>
            </p>
          </div>
        )}

        {/* 1-goal limit + upgrade CTA */}
        <div className="border-2 border-dashed border-border rounded-2xl p-5 text-center">
          <Lock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="font-semibold text-sm">Want to add another goal?</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Free users track 1 goal. Upgrade to Investment Client for unlimited goals, advisor access, and a personalised investment plan.
          </p>
          <Button variant="outline" size="sm" className="mt-4 text-xs border-primary text-primary hover:bg-primary/5">
            Explore Premium →
          </Button>
        </div>
      </div>

      {/* Contribution sheet */}
      <AnimatePresence>
        {contributeOpen && topGoal && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setContributeOpen(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 p-6 pb-10 shadow-2xl"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold">Add to {topGoal.title}</h3>
                <button onClick={() => setContributeOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <CurrencyInput value={amount} onChange={setAmount} currency={currency} label="Contribution amount" />
              <div className="mt-4">
                <label className="text-sm font-medium block mb-1.5">Note (optional)</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Monthly savings transfer" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <Button className="w-full mt-5" disabled={amount <= 0 || addContribution.isPending} onClick={() => addContribution.mutate(topGoal)}>
                {addContribution.isPending ? "Saving…" : "Save contribution"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit goal sheet */}
      <AnimatePresence>
        {editOpen && topGoal && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditOpen(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 p-6 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold">Edit goal</h3>
                <button onClick={() => setEditOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Goal name</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <CurrencyInput value={editTarget} onChange={setEditTarget} currency={currency} label="Target amount" />
                <div>
                  <label className="text-sm font-medium block mb-1.5">Target date</label>
                  <input type="month" value={editDate ? editDate.slice(0, 7) : ""} onChange={e => setEditDate(e.target.value + "-01")} className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <CurrencyInput value={editMonthly} onChange={setEditMonthly} currency={currency} label="Monthly contribution (target)" />
              </div>
              <Button className="w-full mt-6" disabled={!editTitle || editGoal.isPending} onClick={() => editGoal.mutate(topGoal)}>
                {editGoal.isPending ? "Saving…" : "Save changes"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </AppShell>
  );
}
