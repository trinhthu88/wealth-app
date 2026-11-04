// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Split-bar width transitions
// ✓ ALLOWED: Expand/collapse of the transaction form, carry-forward banner and budget-plan rows
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Tailwind default palette (emerald/red/slate…) — design tokens only
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Own bottom nav / back nav / bottom padding hacks — Budget is a main tab; FreeAppShell owns nav + menu-bar padding

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import FreeTierBanner from "@/components/FreeTierBanner";
import Sol from "@/components/Sol";
import CurrencyField from "@/components/shared/CurrencyField";
import InvestableSurplusCard from "@/components/shared/InvestableSurplusCard";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { Pencil, Check, Plus, Trash2, X, RefreshCw, ChevronDown, ChevronUp, ChevronRight, Home, Utensils, Bus, Zap, Ticket, MoreHorizontal, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";

interface BudgetEntry { id?: string; periodMonth: string; currency: string; income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTransaction { id: string; periodMonth: string; description: string; amount: string; type: string; category: string; transactionDate: string; isRecurring: boolean; }

// mono/tile: monogram tiles in the Spending list (approved design). Sunset Pop
// is reserved for a category that runs over plan.
const CATS = [
  { key: "housing" as const, icon: Home, label: "Housing", mono: "HO", tile: "bg-field" },
  { key: "food" as const, icon: Utensils, label: "Food", mono: "FO", tile: "bg-breeze" },
  { key: "transport" as const, icon: Bus, label: "Transport", mono: "TR", tile: "bg-breeze" },
  { key: "utilities" as const, icon: Zap, label: "Utilities", mono: "UT", tile: "bg-paper" },
  { key: "entertainment" as const, icon: Ticket, label: "Entertainment", mono: "EN", tile: "bg-breeze" },
  { key: "other" as const, icon: MoreHorizontal, label: "Other", mono: "OT", tile: "bg-paper" },
];

const TX_CATS = [
  { value: "income", label: "Income", icon: Wallet },
  { value: "housing", label: "Housing", icon: Home },
  { value: "food", label: "Food", icon: Utensils },
  { value: "transport", label: "Transport", icon: Bus },
  { value: "utilities", label: "Utilities", icon: Zap },
  { value: "entertainment", label: "Entertainment", icon: Ticket },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

type BudgetForm = { income: number; housing: number; food: number; transport: number; utilities: number; entertainment: number; other: number; };
type TxForm = { description: string; amount: string; type: string; category: string; transactionDate: string; isRecurring: boolean; };
type TxErrors = { description?: string; amount?: string };

const now = new Date();
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
// The free plan keeps three months: the current one and the two before it.
function recentMonths(today: Date) {
  return [2, 1, 0].map(back => new Date(today.getFullYear(), today.getMonth() - back, 1));
}
function daysLeftInMonth(today: Date) {
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
}
function initials(text: string) {
  const words = text.trim().split(/[\s&/,.-]+/).filter(Boolean);
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
function prevMonthName(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 2, 1).toLocaleDateString("en-US", { month: "long" });
}
function todayLabel(d: Date) {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function groupByDate(txs: BudgetTransaction[]) {
  const groups: Record<string, BudgetTransaction[]> = {};
  for (const tx of txs) {
    const key = tx.transactionDate;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function BudgetPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";
  const sym = currency === "VND" ? "₫" : "$";

  const [viewDate, setViewDate] = useState(now);
  const [showTxForm, setShowTxForm] = useState(false);
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [txErrors, setTxErrors] = useState<TxErrors>({});
  const [carryForwardDismissed, setCarryForwardDismissed] = useState(false);
  const [showEstimates, setShowEstimates] = useState(false);
  const autoShownEstimates = useRef(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const txFormRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<BudgetForm>({ income: 0, housing: 0, food: 0, transport: 0, utilities: 0, entertainment: 0, other: 0 });

  const defaultTxDate = new Date().toISOString().slice(0, 10);
  const [txForm, setTxForm] = useState<TxForm>({
    description: "", amount: "", type: "expense", category: "other",
    transactionDate: defaultTxDate, isRecurring: false,
  });

  const mk = monthKey(viewDate);

  const { data: entries = [], isLoading: entriesLoading } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
  });

  const entry = entries.find(e => e.periodMonth.startsWith(mk));

  const { data: transactions = [], isLoading: txLoading } = useQuery<BudgetTransaction[]>({
    queryKey: ["budget-transactions", mk],
    queryFn: () => apiFetch<BudgetTransaction[]>(`/budget/transactions?month=${mk}`),
  });

  const { data: carryPending } = useQuery<{ pending: boolean; count: number }>({
    queryKey: ["budget-carry-pending", mk],
    queryFn: () => apiFetch(`/budget/transactions/carry-forward-pending?month=${mk}`),
    enabled: !carryForwardDismissed,
  });

  useEffect(() => {
    if (entry) {
      setForm({
        income: parseFloat(entry.income ?? "0"),
        housing: parseFloat(entry.housing ?? "0"),
        food: parseFloat(entry.food ?? "0"),
        transport: parseFloat(entry.transport ?? "0"),
        utilities: parseFloat(entry.utilities ?? "0"),
        entertainment: parseFloat(entry.entertainment ?? "0"),
        other: parseFloat(entry.other ?? "0"),
      });
    } else {
      setForm({ income: 0, housing: 0, food: 0, transport: 0, utilities: 0, entertainment: 0, other: 0 });
    }
    setCarryForwardDismissed(false);
  }, [mk]);

  useEffect(() => {
    if (entry) {
      setForm({
        income: parseFloat(entry.income ?? "0"),
        housing: parseFloat(entry.housing ?? "0"),
        food: parseFloat(entry.food ?? "0"),
        transport: parseFloat(entry.transport ?? "0"),
        utilities: parseFloat(entry.utilities ?? "0"),
        entertainment: parseFloat(entry.entertainment ?? "0"),
        other: parseFloat(entry.other ?? "0"),
      });
    }
  }, [entry?.id]);

  // Auto-expand budget plan when user has no data yet
  useEffect(() => {
    if (entriesLoading || txLoading || autoShownEstimates.current) return;
    if (!entry && !transactions.length) {
      autoShownEstimates.current = true;
      setShowEstimates(true);
    }
  }, [entriesLoading, txLoading, entry?.id, transactions.length]);

  const saveEstimates = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ periodMonth: mk, currency, income: String(form.income), housing: String(form.housing), food: String(form.food), transport: String(form.transport), utilities: String(form.utilities), entertainment: String(form.entertainment), other: String(form.other) });
      if (entry?.id) return apiFetch(`/budget/${entry.id}`, { method: "PUT", body });
      return apiFetch("/budget", { method: "POST", body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      track("budget_saved", { month: mk });
      toast.success("Monthly estimates saved!");
    },
    onError: () => toast.error("Failed to save"),
  });

  const addTx = useMutation({
    mutationFn: () => {
      const isIncome = txType === "income";
      return apiFetch("/budget/transactions", {
        method: "POST",
        body: JSON.stringify({
          periodMonth: mk,
          description: txForm.description,
          amount: txForm.amount,
          type: isIncome ? "income" : "expense",
          category: isIncome ? "income" : txForm.category,
          transactionDate: txForm.transactionDate,
          isRecurring: txForm.isRecurring,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-transactions", mk] });
      queryClient.invalidateQueries({ queryKey: ["budget-transactions"] });
      closeTxForm();
      toast.success(txType === "income" ? "Income logged!" : "Expense logged!");
    },
    onError: () => toast.error("Failed to log transaction"),
  });

  const editTx = useMutation({
    mutationFn: (id: string) => {
      const isIncome = txType === "income";
      return apiFetch(`/budget/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          periodMonth: mk,
          description: txForm.description,
          amount: txForm.amount,
          type: isIncome ? "income" : "expense",
          category: isIncome ? "income" : txForm.category,
          transactionDate: txForm.transactionDate,
          isRecurring: txForm.isRecurring,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-transactions", mk] });
      closeTxForm();
      toast.success("Transaction updated!");
    },
    onError: () => toast.error("Failed to update transaction"),
  });

  const deleteTx = useMutation({
    mutationFn: (id: string) => apiFetch(`/budget/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-transactions", mk] });
      closeTxForm();
    },
  });

  const carryForward = useMutation({
    mutationFn: () => apiFetch("/budget/transactions/carry-forward", { method: "POST", body: JSON.stringify({ targetMonth: mk }) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["budget-transactions", mk] });
      queryClient.invalidateQueries({ queryKey: ["budget-carry-pending", mk] });
      setCarryForwardDismissed(true);
      toast.success(`${data.copied} recurring items copied from ${prevMonthName(mk)}`);
    },
  });

  // Bring the form / plan into view when opened from a row higher up the page.
  useEffect(() => {
    if (showTxForm) txFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showTxForm, editingTxId]);

  function openPlan(field: "income" | (typeof CATS)[number]["key"]) {
    setShowEstimates(true);
    if (field === "income") { setEditingIncome(true); setEditingCat(null); }
    else { setEditingIncome(false); setEditingCat(field); }
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function switchTxType(type: "income" | "expense") {
    setTxType(type);
    setTxForm(f => ({ ...f, type, category: type === "income" ? "income" : (f.category === "income" ? "other" : f.category) }));
  }

  function closeTxForm() {
    setShowTxForm(false);
    setEditingTxId(null);
    setConfirmDeleteId(null);
    setTxErrors({});
    setTxForm({ description: "", amount: "", type: "expense", category: "other", transactionDate: defaultTxDate, isRecurring: false });
  }

  function openTxForm(type: "income" | "expense") {
    setTxType(type);
    setEditingTxId(null);
    setTxErrors({});
    setTxForm({ description: "", amount: "", type, category: type === "income" ? "income" : "other", transactionDate: defaultTxDate, isRecurring: false });
    setShowTxForm(true);
  }

  function openEditForm(tx: BudgetTransaction) {
    const type = tx.type === "income" ? "income" : "expense";
    setTxType(type);
    setEditingTxId(tx.id);
    setTxErrors({});
    setTxForm({
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      transactionDate: tx.transactionDate,
      isRecurring: tx.isRecurring,
    });
    setShowTxForm(true);
    setConfirmDeleteId(null);
  }

  function validateTxForm(): boolean {
    const errors: TxErrors = {};
    if (!txForm.description.trim()) errors.description = "Description is required";
    const amt = parseFloat(txForm.amount);
    if (!txForm.amount || isNaN(amt) || amt <= 0) errors.amount = "Amount must be greater than 0";
    setTxErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submitTxForm() {
    if (!validateTxForm()) return;
    if (editingTxId) {
      editTx.mutate(editingTxId);
    } else {
      addTx.mutate();
    }
  }

  // Totals
  const txIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const txExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const estIncome = form.income;
  const estExpenses = CATS.reduce((s, c) => s + form[c.key], 0);

  const totalIncome = txIncome > 0 ? txIncome : estIncome;
  const totalExpenses = txExpenses > 0 ? txExpenses : estExpenses;
  const saved = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (saved / totalIncome) * 100 : 0;

  // Monthly category breakdown from transactions
  const catTotals = TX_CATS.map(c => ({
    ...c,
    total: transactions.filter(t => t.category === c.value).reduce((s, t) => s + parseFloat(t.amount), 0),
  })).filter(c => c.total > 0);

  const fmt = (n: number) => `${sym}${Math.abs(n).toLocaleString()}`;
  const catIcon = (cat: string) => {
    const CatIcon = TX_CATS.find(c => c.value === cat)?.icon || MoreHorizontal;
    return <CatIcon className="w-4 h-4" />;
  };
  const catLabel = (cat: string) => TX_CATS.find(c => c.value === cat)?.label ?? cat;

  const grouped = groupByDate(transactions);
  const incomeTxs = transactions.filter(t => t.type === "income");

  const isBusy = addTx.isPending || editTx.isPending;

  // Sol's one observation, from real numbers only.
  const biggestExpense = (txExpenses > 0
    ? catTotals.filter(c => c.value !== "income").map(c => ({ label: c.label, value: c.total }))
    : CATS.map(c => ({ label: c.label, value: form[c.key] }))
  ).sort((a, b) => b.value - a.value)[0];
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" });
  const solLine = totalIncome > 0
    ? saved >= 0
      ? `You kept ${savingsRate.toFixed(0)}% of your income in ${monthName}.${biggestExpense && biggestExpense.value > 0 ? ` ${biggestExpense.label} is the biggest share at ${fmt(biggestExpense.value)}.` : ""}`
      : `Spending is ${fmt(saved)} above income in ${monthName}.${biggestExpense && biggestExpense.value > 0 ? ` ${biggestExpense.label} is the largest share at ${fmt(biggestExpense.value)}.` : ""}`
    : null;

  // Split bar: share of income spent vs kept (visual only).
  const spentW = totalIncome > 0 ? Math.max(0, Math.min(100, (totalExpenses / totalIncome) * 100)) : 0;
  const keptW = Math.max(0, 100 - spentW);
  const isCurrentMonth = mk === monthKey(now);
  const pills = recentMonths(now);

  // Spending rows: logged amounts per category when there are expense
  // transactions (compared with the plan), otherwise the plan itself.
  const spendRows = CATS.map(c => {
    const plan = form[c.key];
    const actual = txExpenses > 0 ? (catTotals.find(t => t.value === c.key)?.total ?? 0) : plan;
    const over = txExpenses > 0 && plan > 0 && actual > plan;
    return { ...c, plan, actual, over };
  }).filter(r => r.actual > 0 || r.plan > 0);

  const kept = totalIncome > 0 ? `${saved < 0 ? "−" : ""}${fmt(saved)}` : "—";

  const inputCls = "w-full h-11 rounded-[16px] bg-paper px-4 text-[14px] text-forest border outline-none transition-colors placeholder:text-ink-30 focus:border-green";
  const primaryBtn = "h-11 w-full rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60";
  const rowCls = "flex w-full min-h-[64px] items-center gap-3 border-b border-hairline p-3 text-left last:border-0 transition-colors hover:bg-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest/30";
  const tileCls = "flex h-10 w-10 flex-none items-center justify-center rounded-[12px] text-[12px] font-semibold text-forest";

  return (
    <AppShell>
      <div className="space-y-[14px] pb-8">

        {/* Title + month pills */}
        <div className="px-1 pt-1">
          <p className="tala-eyebrow text-ink-40">Monthly budget</p>
          <h1 className="mt-1 font-display text-[36px] leading-[1.05] text-forest">{monthLabel(viewDate)}</h1>
          <p className="mt-1 text-[14px] text-ink-40">
            {isCurrentMonth ? `This month · ${daysLeftInMonth(now)} days left` : "Earlier month · you can still log and edit"}
          </p>
        </div>

        <div className="flex gap-1.5" role="group" aria-label="Choose month">
          {pills.map(d => {
            const active = monthKey(d) === mk;
            return (
              <button
                type="button"
                key={monthKey(d)}
                onClick={() => setViewDate(d)}
                aria-pressed={active}
                aria-label={monthLabel(d)}
                className={cn(
                  "h-10 rounded-full px-[18px] text-[14px] font-semibold transition-colors",
                  active ? "bg-forest text-paper" : "border-[1.5px] border-hairline-2 text-forest hover:bg-surface",
                )}
              >
                {d.toLocaleDateString("en-US", { month: "short" })}
              </button>
            );
          })}
        </div>

        {/* Hero — the one focal number */}
        <section aria-label={`Kept in ${monthLabel(viewDate)}`} className="flex flex-col gap-3.5 rounded-[28px] bg-forest p-5">
          <p className="tala-eyebrow text-mint">Kept in {monthName}</p>
          <div className="flex items-end justify-between gap-2">
            <span className="min-w-0 truncate font-display tabular-nums text-[56px] leading-[0.9] tracking-[-0.045em] text-paper">
              {kept}
            </span>
            {totalIncome > 0 && (
              saved >= 0 ? (
                <span className="shrink-0 rounded-full bg-field px-3 py-1.5 text-[12px] font-semibold text-forest whitespace-nowrap">
                  {savingsRate.toFixed(0)}% savings rate
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-sun px-3 py-1.5 text-[12px] font-semibold text-forest whitespace-nowrap">
                  Over income
                </span>
              )
            )}
          </div>
          {totalIncome > 0 && (
            <div
              role="img"
              aria-label={`Of ${fmt(totalIncome)} income: ${fmt(totalExpenses)} spent, ${fmt(Math.max(0, saved))} kept`}
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/10"
            >
              {spentW > 0 && <span className="h-full bg-sun transition-[width] duration-[400ms] ease-out" style={{ width: `${spentW}%` }} />}
              {keptW > 0 && <span className="h-full bg-field transition-[width] duration-[400ms] ease-out" style={{ width: `${keptW}%` }} />}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex min-w-0 flex-col gap-[3px]">
              <div className="text-[12px] text-mint">Income</div>
              <div className="truncate text-[16px] font-semibold tabular-nums text-paper">{totalIncome > 0 ? fmt(totalIncome) : "—"}</div>
            </div>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <div className="flex items-center gap-[5px] text-[12px] text-mint">
                <span className="h-2 w-2 rounded-[2px] bg-sun" aria-hidden="true" />Spent
              </div>
              <div className="truncate text-[16px] font-semibold tabular-nums text-paper">{totalExpenses > 0 ? fmt(totalExpenses) : "—"}</div>
            </div>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <div className="flex items-center gap-[5px] text-[12px] text-mint">
                <span className="h-2 w-2 rounded-[2px] bg-field" aria-hidden="true" />Kept
              </div>
              <div className="truncate text-[16px] font-semibold tabular-nums text-paper">{kept}</div>
            </div>
          </div>
        </section>

        {/* Carry-forward banner */}
        <AnimatePresence>
          {carryPending?.pending && !carryForwardDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center gap-3 rounded-[24px] bg-surface p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-field text-forest" aria-hidden="true">
                <RefreshCw className="h-4 w-4" />
              </span>
              <p className="min-w-0 flex-1 text-[14px] font-medium leading-[1.4] text-forest text-pretty">
                {carryPending.count} recurring items from {prevMonthName(mk)} — copy them over?
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => carryForward.mutate()} disabled={carryForward.isPending}
                  className="h-11 rounded-full bg-forest px-4 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {carryForward.isPending ? "…" : "Yes, copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setCarryForwardDismissed(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-forest/60 transition-colors hover:bg-forest/10 hover:text-forest"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sol tip */}
        {solLine && (
          <section aria-label="Sol" className="flex items-start gap-3 rounded-[24px] bg-breeze p-4 text-forest">
            <Sol size="sm" animate="breathe" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-[14px] font-semibold leading-[1.5] text-pretty">{solLine}</p>
              <p className="text-[13px] leading-[1.5] text-pretty">
                A savings rate near 20–30% is strong by most standards. Small drift in one category matters far less than the rate holding steady.
              </p>
            </div>
          </section>
        )}

        {/* Surplus prompt */}
        {totalIncome > 0 && <InvestableSurplusCard surplus={saved} currency={currency} />}

        {/* Income */}
        <section aria-label="Income" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1 pt-1.5">
            <h2 className="font-sans text-[16px] font-semibold text-forest">Income</h2>
            <span className="text-[15px] font-semibold tabular-nums text-forest">{totalIncome > 0 ? fmt(totalIncome) : "—"}</span>
          </div>
          <div className="flex flex-col overflow-hidden rounded-[24px] bg-surface p-1">
            {incomeTxs.length > 0 ? incomeTxs.map(tx => (
              <button key={tx.id} type="button" onClick={() => openEditForm(tx)} className={rowCls} aria-label={`Edit ${tx.description}`}>
                <span className={cn(tileCls, "bg-field")} aria-hidden="true">{initials(tx.description)}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-medium text-forest">{tx.description}</span>
                  <span className="text-[12px] text-ink-40">
                    {tx.isRecurring ? "Recurring · " : ""}{todayLabel(new Date(tx.transactionDate + "T00:00:00"))}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-forest">{sym}{parseFloat(tx.amount).toLocaleString()}</span>
              </button>
            )) : form.income > 0 ? (
              <button type="button" onClick={() => openPlan("income")} className={rowCls}>
                <span className={cn(tileCls, "bg-field")} aria-hidden="true">IN</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[14px] font-medium text-forest">Monthly income</span>
                  <span className="text-[12px] text-ink-40">Planned · from your budget plan</span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-forest">{fmt(form.income)}</span>
              </button>
            ) : (
              <button type="button" onClick={() => openTxForm("income")} className={rowCls}>
                <span className={cn(tileCls, "bg-paper")} aria-hidden="true"><Plus className="h-4 w-4" /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-medium text-forest">Add your income</span>
                  <span className="text-[12px] text-ink-40">Salary, freelance, rental…</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-40" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        {/* Spending */}
        <section aria-label="Spending" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1 pt-1.5">
            <h2 className="font-sans text-[16px] font-semibold text-forest">Spending</h2>
            <span className="text-[15px] font-semibold tabular-nums text-forest">{totalExpenses > 0 ? fmt(totalExpenses) : "—"}</span>
          </div>
          <div className="flex flex-col overflow-hidden rounded-[24px] bg-surface p-1">
            {spendRows.length > 0 ? spendRows.map(r => {
              const share = totalIncome > 0 ? `${Math.round((r.actual / totalIncome) * 100)}% of income` : null;
              const planNote = txExpenses > 0 && r.plan > 0 ? `${fmt(r.plan)} planned` : txExpenses > 0 ? "No plan set" : "Planned";
              return (
                <button key={r.key} type="button" onClick={() => openPlan(r.key)} className={rowCls} aria-label={`${r.label}: ${fmt(r.actual)}${r.over ? ", over plan" : ""}. Edit plan`}>
                  <span className={cn(tileCls, r.over ? "bg-sun" : r.tile)} aria-hidden="true">{r.mono}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14px] font-medium text-forest">{r.label}</span>
                    <span className="truncate text-[12px] text-ink-40">{[share, planNote].filter(Boolean).join(" · ")}</span>
                  </span>
                  {r.over && (
                    <span className="shrink-0 rounded-full bg-sun px-2 py-[3px] text-[11px] font-semibold text-forest whitespace-nowrap">Over plan</span>
                  )}
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-forest">{fmt(r.actual)}</span>
                </button>
              );
            }) : (
              <button type="button" onClick={() => openTxForm("expense")} className={rowCls}>
                <span className={cn(tileCls, "bg-paper")} aria-hidden="true"><Plus className="h-4 w-4" /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-medium text-forest">No spending yet</span>
                  <span className="text-[12px] text-ink-40">Log an expense or set a plan below</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-40" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        {/* Log a transaction */}
        {!showTxForm && (
          <button
            type="button"
            onClick={() => openTxForm("expense")}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-forest text-[14px] font-semibold text-forest transition-colors hover:bg-surface"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Log a transaction
          </button>
        )}

        {/* Transaction form (add & edit) */}
        <AnimatePresence>
          {showTxForm && (
            <motion.div
              ref={txFormRef}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="scroll-mt-4 space-y-3 rounded-[24px] bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-forest">
                  {editingTxId
                    ? (txType === "income" ? "Edit income" : "Edit expense")
                    : "Log a transaction"}
                </h3>
                <button
                  type="button"
                  onClick={closeTxForm}
                  className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-40 transition-colors hover:bg-paper hover:text-forest"
                  aria-label="Close form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-1.5" role="group" aria-label="Transaction type">
                {(["expense", "income"] as const).map(t => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => switchTxType(t)}
                    aria-pressed={txType === t}
                    className={cn(
                      "h-10 rounded-full px-[18px] text-[14px] font-semibold transition-colors",
                      txType === t ? "bg-forest text-paper" : "border-[1.5px] border-hairline-2 text-forest hover:bg-paper",
                    )}
                  >
                    {t === "expense" ? "Expense" : "Income"}
                  </button>
                ))}
              </div>

              <div>
                <input
                  placeholder={txType === "income" ? "e.g. Monthly salary" : "e.g. Grab lunch"}
                  aria-label="Description"
                  value={txForm.description}
                  onChange={e => {
                    setTxForm(f => ({ ...f, description: e.target.value }));
                    if (txErrors.description) setTxErrors(e => ({ ...e, description: undefined }));
                  }}
                  className={cn(inputCls, txErrors.description ? "border-clay" : "border-hairline-2")}
                  aria-invalid={!!txErrors.description}
                  autoFocus
                />
                {txErrors.description && <p className="mt-1 ml-1 text-[12px] text-clay-ink">{txErrors.description}</p>}
              </div>

              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-ink-40">{sym}</span>
                    <input
                      type="number" placeholder="0"
                      aria-label="Amount"
                      value={txForm.amount}
                      onChange={e => {
                        setTxForm(f => ({ ...f, amount: e.target.value }));
                        if (txErrors.amount) setTxErrors(e => ({ ...e, amount: undefined }));
                      }}
                      className={cn(inputCls, "pl-8 tabular-nums", txErrors.amount ? "border-clay" : "border-hairline-2")}
                      aria-invalid={!!txErrors.amount}
                    />
                  </div>
                  {txErrors.amount && <p className="mt-1 ml-1 text-[12px] text-clay-ink">{txErrors.amount}</p>}
                </div>
                <input
                  type="date" value={txForm.transactionDate}
                  aria-label="Date"
                  onChange={e => setTxForm(f => ({ ...f, transactionDate: e.target.value }))}
                  className={cn(inputCls, "min-w-0 flex-1 border-hairline-2 px-3")}
                />
              </div>

              {txType === "expense" && (
                <div className="flex flex-wrap gap-2">
                  {TX_CATS.filter(c => c.value !== "income").map(c => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setTxForm(f => ({ ...f, category: c.value }))}
                      aria-pressed={txForm.category === c.value}
                      className={cn(
                        "flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                        txForm.category === c.value ? "bg-forest text-paper" : "bg-paper text-forest hover:bg-breeze"
                      )}
                    >
                      <c.icon className="h-3.5 w-3.5" /> {c.label}
                    </button>
                  ))}
                </div>
              )}

              <label className="flex cursor-pointer select-none items-center gap-3 py-1 text-[14px]">
                <div
                  onClick={() => setTxForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
                  className={cn("relative h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors",
                    txForm.isRecurring ? "bg-forest" : "bg-track")}
                >
                  <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow-[0_1px_3px_rgba(12,33,164,0.2)] transition-transform",
                    txForm.isRecurring ? "translate-x-4" : "translate-x-0.5")} />
                </div>
                <div>
                  <span className="font-medium text-forest">Recurring</span>
                  {txForm.isRecurring
                    ? <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-forest"><RefreshCw className="h-3 w-3" /> Copies automatically next month</span>
                    : <span className="ml-2 text-[12px] text-ink-40">One-off entry</span>}
                </div>
              </label>

              <button type="button" className={primaryBtn} onClick={submitTxForm} disabled={isBusy}>
                {isBusy ? "Saving…" : editingTxId ? "Update transaction" : `Save ${txType === "income" ? "income" : "expense"}`}
              </button>

              {editingTxId && (
                confirmDeleteId === editingTxId ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => deleteTx.mutate(editingTxId)}
                      disabled={deleteTx.isPending}
                      className="h-11 flex-1 rounded-full bg-sun px-4 text-[14px] font-semibold text-forest disabled:opacity-60"
                    >
                      {deleteTx.isPending ? "Deleting…" : "Yes, delete it"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="h-11 flex-1 rounded-full border-[1.5px] border-forest px-4 text-[14px] font-semibold text-forest"
                    >
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(editingTxId)}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold text-forest transition-colors hover:bg-paper"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete transaction
                  </button>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transactions (by day) */}
        {txLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-[24px] bg-surface" />)}</div>
        ) : grouped.length > 0 && (
          <section aria-label="Transactions" className="space-y-2.5">
            <div className="flex items-baseline justify-between px-1 pt-1.5">
              <h2 className="font-sans text-[16px] font-semibold text-forest">Transactions</h2>
              <span className="text-[13px] text-ink-40 tabular-nums">{transactions.length} logged</span>
            </div>
            <div className="space-y-3">
              {grouped.map(([date, txs]) => {
                const parsedDate = new Date(date + "T00:00:00");
                return (
                  <div key={date} className="overflow-hidden rounded-[24px] bg-surface p-1">
                    <p className="tala-eyebrow px-3 pb-1 pt-2.5 text-ink-40">{todayLabel(parsedDate)}</p>
                    {txs.map(tx => (
                      <button key={tx.id} type="button" onClick={() => openEditForm(tx)} className={rowCls} aria-label={`Edit ${tx.description}`}>
                        <span className={cn(tileCls, tx.type === "income" ? "bg-field" : "bg-paper")} aria-hidden="true">
                          {catIcon(tx.category)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[14px] font-medium text-forest">{tx.description}</span>
                            {tx.isRecurring && <RefreshCw className="h-3 w-3 shrink-0 text-ink-40" aria-label="Recurring" />}
                          </span>
                          <span className="text-[12px] text-ink-40">{catLabel(tx.category)}</span>
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-forest">
                          {tx.type === "income" ? "+" : "−"}{sym}{parseFloat(tx.amount).toLocaleString()}
                        </span>
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-40" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Monthly budget plan (collapsible) */}
        <section ref={planRef} aria-label="Monthly budget plan" className="scroll-mt-4 overflow-hidden rounded-[24px] bg-surface">
          <button
            type="button"
            onClick={() => setShowEstimates(v => !v)}
            aria-expanded={showEstimates}
            className="flex min-h-[64px] w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div>
              <h3 className="text-[15px] font-semibold text-forest">Monthly budget plan</h3>
              <p className="mt-0.5 text-[13px] text-ink-40">Set target amounts per category</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-forest" aria-hidden="true">
              {showEstimates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>

          <AnimatePresence>
            {showEstimates && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-1">
                  <div className={cn("rounded-[16px] border-b border-hairline", editingIncome && "bg-paper/60")}>
                    <button type="button" onClick={() => setEditingIncome(v => !v)} className="flex min-h-[64px] w-full items-center justify-between gap-3 p-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className={cn(tileCls, "bg-field")} aria-hidden="true">IN</span>
                        <span className="text-[14px] font-medium text-forest">Income</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[15px] font-semibold tabular-nums", form.income > 0 ? "text-forest" : "text-ink-40")}>
                          {form.income > 0 ? `${sym}${form.income.toLocaleString()}` : "Set amount"}
                        </span>
                        {editingIncome ? <Check className="h-4 w-4 text-forest" /> : <Pencil className="h-4 w-4 text-ink-40" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {editingIncome && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-3 pb-4"><CurrencyField editable value={form.income} onChange={v => setForm(f => ({ ...f, income: v }))} currency={currency} /></div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {CATS.map((cat, i) => (
                    <div key={cat.key} className={cn("rounded-[16px]", i < CATS.length - 1 && "border-b border-hairline", editingCat === cat.key && "bg-paper/60")}>
                      <button type="button" onClick={() => setEditingCat(editingCat === cat.key ? null : cat.key)} className="flex min-h-[64px] w-full items-center justify-between gap-3 p-3 text-left">
                        <div className="flex items-center gap-3">
                          <span className={cn(tileCls, cat.tile)} aria-hidden="true">{cat.mono}</span>
                          <span className="text-[14px] font-medium text-forest">{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[15px] font-semibold tabular-nums", form[cat.key] > 0 ? "text-forest" : "text-ink-40")}>
                            {form[cat.key] > 0 ? `${sym}${form[cat.key].toLocaleString()}` : "—"}
                          </span>
                          {editingCat === cat.key ? <Check className="h-4 w-4 text-forest" /> : <Pencil className="h-4 w-4 text-ink-40" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {editingCat === cat.key && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="px-3 pb-4"><CurrencyField editable value={form[cat.key]} onChange={v => setForm(f => ({ ...f, [cat.key]: v }))} currency={currency} /></div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                <div className="p-4 pt-3">
                  <button type="button" className={primaryBtn} onClick={() => saveEstimates.mutate()} disabled={saveEstimates.isPending}>
                    {saveEstimates.isPending ? "Saving…" : "Save budget plan"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <FreeTierBanner
          feature="The free plan keeps 3 months of budgets"
          benefit="Advised clients see 12 months of history, with investing contributions and goal funding synced in."
          storageKey="budget"
        />
      </div>
    </AppShell>
  );
}
