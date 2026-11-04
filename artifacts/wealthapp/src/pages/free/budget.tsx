// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart / progress-bar width transitions
// ✓ ALLOWED: Expand/collapse of the transaction form and budget-plan rows
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Tailwind default palette (emerald/red/slate…) — design tokens only
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Own bottom nav / back nav / bottom padding hacks — FreeAppShell owns nav + menu-bar padding

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import FreeTierBanner from "@/components/FreeTierBanner";
import SolNarration from "@/components/client/SolNarration";
import CurrencyField from "@/components/shared/CurrencyField";
import InvestableSurplusCard from "@/components/shared/InvestableSurplusCard";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Check, Plus, Trash2, X, RefreshCw, ChevronDown, ChevronUp, Home, Utensils, Bus, Zap, Ticket, MoreHorizontal, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";

interface BudgetEntry { id?: string; periodMonth: string; currency: string; income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTransaction { id: string; periodMonth: string; description: string; amount: string; type: string; category: string; transactionDate: string; isRecurring: boolean; }

const CATS = [
  { key: "housing" as const, icon: Home, label: "Housing" },
  { key: "food" as const, icon: Utensils, label: "Food" },
  { key: "transport" as const, icon: Bus, label: "Transport" },
  { key: "utilities" as const, icon: Zap, label: "Utilities" },
  { key: "entertainment" as const, icon: Ticket, label: "Entertainment" },
  { key: "other" as const, icon: MoreHorizontal, label: "Other" },
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
  const [view, setView] = useState<"daily" | "monthly">("daily");
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
      setConfirmDeleteId(null);
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

  function closeTxForm() {
    setShowTxForm(false);
    setEditingTxId(null);
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

  const prevMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); };
  const nextMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); if (d <= now) setViewDate(d); };


  const fmt = (n: number) => `${sym}${Math.abs(n).toLocaleString()}`;
  const catIcon = (cat: string) => {
    const CatIcon = TX_CATS.find(c => c.value === cat)?.icon || MoreHorizontal;
    return <CatIcon className="w-4 h-4" />;
  };
  const catLabel = (cat: string) => TX_CATS.find(c => c.value === cat)?.label ?? cat;

  const grouped = groupByDate(transactions);

  // Category dot colours (visual only) — design tokens, Sunset Pop reserved for over-budget.
  const CAT_DOTS: Record<string, string> = {
    housing: "bg-forest", food: "bg-breeze", transport: "bg-field",
    utilities: "bg-violet", entertainment: "bg-forest-700", other: "bg-ink-30",
    income: "bg-field",
  };

  const isBusy = addTx.isPending || editTx.isPending;

  // Sol's one observation, from real numbers only.
  const biggestExpense = (txExpenses > 0
    ? catTotals.filter(c => c.value !== "income").map(c => ({ label: c.label, value: c.total }))
    : CATS.map(c => ({ label: c.label, value: form[c.key] }))
  ).sort((a, b) => b.value - a.value)[0];
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" });
  const solLine = totalIncome > 0
    ? saved >= 0
      ? `You kept ${savingsRate.toFixed(0)}% of income in ${monthName}.${biggestExpense && biggestExpense.value > 0 ? ` ${biggestExpense.label} is your biggest category at ${fmt(biggestExpense.value)}.` : ""}`
      : `Spending is ${fmt(saved)} above income in ${monthName}.${biggestExpense && biggestExpense.value > 0 ? ` ${biggestExpense.label} is the largest share at ${fmt(biggestExpense.value)}.` : ""}`
    : null;

  // Split bar: share of income spent vs kept (visual only).
  const spentW = totalIncome > 0 ? Math.max(0, Math.min(100, (totalExpenses / totalIncome) * 100)) : 0;
  const keptW = Math.max(0, 100 - spentW);
  const atCurrentMonth = mk >= monthKey(now);

  const inputCls = "w-full h-11 rounded-2xl bg-paper px-4 text-[14px] text-forest border outline-none transition-colors placeholder:text-ink-30 focus:border-green";
  const primaryBtn = "h-11 w-full rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60";

  return (
    <AppShell>
      <div className="space-y-4 pb-8">

        {solLine && (
          <SolNarration
            className="mb-0"
            line={solLine}
            detail="A savings rate near 20–30% is strong by most standards. Small month-to-month drift in one category matters far less than the rate holding steady over time."
          />
        )}

        {/* Title + month switcher */}
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <h1 className="font-display text-[30px] leading-[1.1] text-forest">Budget</h1>
            <p className="mt-1 text-[14px] text-ink-40">Track what comes in and what goes out.</p>
          </div>
          <div className="flex items-center rounded-full bg-surface p-0.5" role="group" aria-label="Choose month">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-paper"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[116px] text-center text-[13px] font-semibold text-forest tabular-nums">{monthLabel(viewDate)}</span>
            <button
              type="button"
              onClick={nextMonth}
              disabled={atCurrentMonth}
              aria-label="Next month"
              className="flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hero — the one focal number */}
        <section aria-label={`Kept in ${monthLabel(viewDate)}`} className="bg-forest rounded-[28px] p-5 flex flex-col gap-3.5">
          <p className="tala-eyebrow text-mint">Kept in {monthName}</p>
          <div className="flex items-end justify-between gap-2">
            <span className="font-display tabular-nums text-[56px] leading-[0.9] tracking-[-0.04em] text-paper min-w-0 truncate">
              {totalIncome > 0 ? `${saved < 0 ? "−" : ""}${fmt(saved)}` : "—"}
            </span>
            {totalIncome > 0 && (
              saved >= 0 ? (
                <span className="shrink-0 rounded-full bg-field px-[11px] py-1.5 text-[12px] font-semibold text-forest whitespace-nowrap">
                  {savingsRate.toFixed(0)}% savings rate
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-sun-tint px-[11px] py-1.5 text-[12px] font-semibold text-amber-ink whitespace-nowrap">
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
              {spentW > 0 && <span className={cn("h-full", saved < 0 ? "bg-sun" : "bg-breeze")} style={{ width: `${spentW}%` }} />}
              {keptW > 0 && <span className="h-full bg-field" style={{ width: `${keptW}%` }} />}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-[3px]">
              <div className="text-[12px] text-mint">Income</div>
              <div className="text-[16px] font-semibold text-paper tabular-nums">{totalIncome > 0 ? fmt(totalIncome) : "—"}</div>
            </div>
            <div className="flex flex-col gap-[3px]">
              <div className="flex items-center gap-[5px] text-[12px] text-mint">
                <span className={cn("h-2 w-2 rounded-[2px]", saved < 0 ? "bg-sun" : "bg-breeze")} aria-hidden="true" />Spent
              </div>
              <div className="text-[16px] font-semibold text-paper tabular-nums">{totalExpenses > 0 ? fmt(totalExpenses) : "—"}</div>
            </div>
          </div>
        </section>

        {/* Carry-forward banner */}
        <AnimatePresence>
          {carryPending?.pending && !carryForwardDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center gap-3 rounded-[24px] bg-green-tint p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-paper text-forest" aria-hidden="true">
                <RefreshCw className="h-4 w-4" />
              </span>
              <p className="flex-1 min-w-0 text-[14px] font-medium leading-[1.4] text-forest text-pretty">
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

        {/* Primary action tiles */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => openTxForm("income")}
            className="rounded-[24px] bg-field p-4 text-left transition-opacity hover:opacity-90"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-paper text-forest" aria-hidden="true">
              <Plus className="h-4 w-4" />
            </span>
            <p className="text-[14px] font-semibold text-forest">Log income</p>
            <p className="mt-0.5 text-[12px] text-forest/70">Salary, freelance, etc.</p>
          </button>
          <button
            type="button"
            onClick={() => openTxForm("expense")}
            className="rounded-[24px] bg-breeze p-4 text-left transition-opacity hover:opacity-90"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-paper text-forest" aria-hidden="true">
              <Plus className="h-4 w-4" />
            </span>
            <p className="text-[14px] font-semibold text-forest">Log expense</p>
            <p className="mt-0.5 text-[12px] text-forest/70">Food, rent, bills, etc.</p>
          </button>
        </div>

        {/* Transaction form (add & edit) */}
        <AnimatePresence>
          {showTxForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-surface rounded-[24px] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-forest">
                  {editingTxId
                    ? (txType === "income" ? "Edit income" : "Edit expense")
                    : (txType === "income" ? "Log income" : "Log expense")}
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

              <div>
                <input
                  placeholder={txType === "income" ? "e.g. Monthly salary" : "e.g. Grab lunch"}
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
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-ink-40">{sym}</span>
                    <input
                      type="number" placeholder="0"
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
                  onChange={e => setTxForm(f => ({ ...f, transactionDate: e.target.value }))}
                  className={cn(inputCls, "flex-1 min-w-0 px-3 border-hairline-2")}
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
                        txForm.category === c.value ? "bg-forest text-paper" : "bg-paper text-forest hover:bg-green-tint"
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily / Monthly toggle */}
        <div className="flex gap-1 rounded-full bg-surface p-1" role="tablist" aria-label="Budget view">
          {(["daily", "monthly"] as const).map(v => (
            <button
              type="button"
              role="tab"
              aria-selected={view === v}
              key={v}
              onClick={() => setView(v)}
              className={cn("h-11 flex-1 rounded-full text-[13px] font-semibold transition-colors",
                view === v ? "bg-field text-forest" : "text-ink-40 hover:text-forest")}
            >
              {v === "daily" ? "Daily transactions" : "Monthly breakdown"}
            </button>
          ))}
        </div>

        {/* DAILY VIEW */}
        {view === "daily" && (
          <>
            {txLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-[24px] bg-surface" />)}</div>
            ) : grouped.length > 0 ? (
              <div className="space-y-3">
                {grouped.map(([date, txs]) => {
                  const dayIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
                  const dayExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
                  const parsedDate = new Date(date + "T00:00:00");
                  return (
                    <div key={date} className="overflow-hidden rounded-[24px] bg-surface p-1">
                      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                        <p className="tala-eyebrow text-ink-40">{todayLabel(parsedDate)}</p>
                        <div className="flex gap-3 text-[12px] font-semibold tabular-nums">
                          {dayIncome > 0 && <span className="text-forest">+{fmt(dayIncome)}</span>}
                          {dayExpense > 0 && <span className="text-ink-40">−{fmt(dayExpense)}</span>}
                        </div>
                      </div>
                      {txs.map((tx, i) => (
                        <div key={tx.id} className={cn("flex min-h-[64px] items-center gap-3 p-3", i < txs.length - 1 && "border-b border-hairline")}>
                          <span
                            className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-[14px] text-forest", tx.type === "income" ? "bg-field" : "bg-paper")}
                            aria-hidden="true"
                          >
                            {catIcon(tx.category)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[14px] font-medium text-forest">{tx.description}</p>
                              {tx.isRecurring && (
                                <span className="flex flex-shrink-0 items-center justify-center rounded-full bg-green-tint px-1.5 py-0.5 text-forest" aria-label="Recurring">
                                  <RefreshCw className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-ink-40">{catLabel(tx.category)}</p>
                          </div>
                          <span className="flex-shrink-0 text-[15px] font-semibold tabular-nums text-forest">
                            {tx.type === "income" ? "+" : "−"}{sym}{parseFloat(tx.amount).toLocaleString()}
                          </span>

                          {/* Edit & Delete controls */}
                          {confirmDeleteId === tx.id ? (
                            <div className="flex flex-shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => deleteTx.mutate(tx.id)}
                                disabled={deleteTx.isPending}
                                className="h-9 rounded-full bg-sun-tint px-3 text-[12px] font-semibold text-amber-ink disabled:opacity-60"
                              >
                                {deleteTx.isPending ? "…" : "Delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="h-9 rounded-full px-3 text-[12px] font-medium text-ink-40 hover:bg-paper hover:text-forest"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-shrink-0 items-center">
                              <button
                                type="button"
                                onClick={() => openEditForm(tx)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-40 transition-colors hover:bg-paper hover:text-forest"
                                aria-label={`Edit ${tx.description}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-40 transition-colors hover:bg-paper hover:text-clay-ink"
                                aria-label={`Delete ${tx.description}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center rounded-[24px] bg-surface p-6 text-center">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-breeze text-forest" aria-hidden="true">
                  <Wallet className="h-4 w-4" />
                </span>
                <h3 className="text-[15px] font-semibold text-forest">No transactions yet for {monthLabel(viewDate)}</h3>
                <p className="mt-1 text-[14px] leading-[1.5] text-ink-40 text-pretty">Tap “Log income” or “Log expense” above to start tracking.</p>
              </div>
            )}
          </>
        )}

        {/* MONTHLY VIEW */}
        {view === "monthly" && (
          <div className="space-y-4">
            {catTotals.length > 0 ? (
              <section aria-label="Spending by category" className="rounded-[24px] bg-surface p-5">
                <h3 className="text-[15px] font-semibold text-forest">Spending by category</h3>
                <div className="mt-2">
                  {catTotals.map((c, i) => {
                    const isIncome = c.value === "income";
                    const pct = totalExpenses > 0 && !isIncome ? (c.total / totalExpenses) * 100 : 0;
                    const dotCls = CAT_DOTS[c.value] ?? "bg-ink-30";
                    const budgetAmt = !isIncome ? (form as any)[c.value] as number ?? 0 : 0;
                    const variance = !isIncome && budgetAmt > 0 ? c.total - budgetAmt : null;
                    const over = variance !== null && variance > 0;
                    return (
                      <div key={c.value} className={cn("py-3", i < catTotals.length - 1 && "border-b border-hairline")}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", dotCls)} aria-hidden="true" />
                            <span className="truncate text-[14px] font-medium text-forest">{c.label}</span>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            {variance !== null && (
                              over ? (
                                <span className="rounded-full bg-sun-tint px-2 py-[3px] text-[11px] font-semibold text-amber-ink whitespace-nowrap">
                                  +{sym}{Math.round(variance).toLocaleString()} over
                                </span>
                              ) : (
                                <span className="text-[12px] font-medium text-ink-40 whitespace-nowrap">
                                  {sym}{Math.abs(Math.round(variance)).toLocaleString()} under
                                </span>
                              )
                            )}
                            {!isIncome && variance === null && totalExpenses > 0 && (
                              <span className="text-[12px] text-ink-40 tabular-nums">{pct.toFixed(0)}%</span>
                            )}
                            <span className="text-[15px] font-semibold text-forest tabular-nums">
                              {isIncome ? "+" : ""}{sym}{c.total.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {!isIncome && (
                          <div className="relative h-2 overflow-hidden rounded-full bg-track">
                            {budgetAmt > 0 && (
                              <div className="absolute h-full rounded-full bg-breeze" style={{ width: `${Math.min(100, (budgetAmt / Math.max(budgetAmt, c.total)) * 100)}%` }} />
                            )}
                            <div
                              className={cn("absolute h-full rounded-full transition-[width] duration-[400ms] ease-out", over ? "bg-sun" : "bg-forest")}
                              style={{ width: `${Math.min(100, budgetAmt > 0 ? (c.total / Math.max(budgetAmt, c.total)) * 100 : pct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="rounded-[24px] bg-surface p-5 text-center">
                <p className="text-[14px] leading-[1.5] text-ink-40 text-pretty">Log transactions to see your monthly breakdown by category.</p>
              </div>
            )}

            {/* Monthly budget plan (collapsible) */}
            <section aria-label="Monthly budget plan" className="overflow-hidden rounded-[24px] bg-surface">
              <button
                type="button"
                onClick={() => setShowEstimates(v => !v)}
                aria-expanded={showEstimates}
                className="flex min-h-[64px] w-full items-center justify-between gap-3 p-5 text-left"
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
                      <div className={cn("rounded-2xl border-b border-hairline", editingIncome && "bg-paper/60")}>
                        <button type="button" onClick={() => setEditingIncome(v => !v)} className="flex min-h-[64px] w-full items-center justify-between gap-3 p-3 text-left">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-field text-forest" aria-hidden="true"><Wallet className="h-4 w-4" /></span>
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
                        <div key={cat.key} className={cn("rounded-2xl", i < CATS.length - 1 && "border-b border-hairline", editingCat === cat.key && "bg-paper/60")}>
                          <button type="button" onClick={() => setEditingCat(editingCat === cat.key ? null : cat.key)} className="flex min-h-[64px] w-full items-center justify-between gap-3 p-3 text-left">
                            <div className="flex items-center gap-3">
                              <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-[14px] text-forest", i % 2 === 0 ? "bg-breeze" : "bg-paper")} aria-hidden="true">
                                <cat.icon className="h-4 w-4" />
                              </span>
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

                    <div className="p-5 pt-3">
                      <button type="button" className={primaryBtn} onClick={() => saveEstimates.mutate()} disabled={saveEstimates.isPending}>
                        {saveEstimates.isPending ? "Saving…" : "Save budget plan"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        )}

        {totalIncome > 0 && <InvestableSurplusCard surplus={saved} currency={currency} />}

        <FreeTierBanner
          feature="Basic income and expense tracking"
          benefit="Investment clients get investment contribution sync, goal funding analysis, and 12-month history charts."
          storageKey="budget"
        />
      </div>
    </AppShell>
  );
}
