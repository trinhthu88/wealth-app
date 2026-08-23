// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default)
// ✓ ALLOWED: BottomSheet spring animation
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#FAF8F5, #F2EFE9, #A8A095)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Double bottom nav — AppShell is the ONLY nav

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import FreeTierBanner from "@/components/FreeTierBanner";
import CurrencyField from "@/components/shared/CurrencyField";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budget"] }); toast.success("Monthly estimates saved!"); },
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
    return <CatIcon className="w-4 h-4 text-muted-foreground" />;
  };
  const catLabel = (cat: string) => TX_CATS.find(c => c.value === cat)?.label ?? cat;

  const grouped = groupByDate(transactions);

  const CAT_COLORS: Record<string, string> = {
    housing: "var(--forest-700)", food: "var(--green)", transport: "var(--sun)",
    utilities: "var(--ink-40)", entertainment: "var(--clay)", other: "var(--ink-40)",
    income: "var(--green)",
  };

  const isBusy = addTx.isPending || editTx.isPending;

  return (
    <AppShell>
      <div className="pb-20 md:pb-0">

        <FreeTierBanner
          feature="Basic income and expense tracking"
          benefit="Investment clients get investment contribution sync, goal funding analysis, and 12-month history charts."
          storageKey="budget"
        />

        {/* Dark navy header */}
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 bg-forest p-[20px_22px_48px]">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-[22px] font-bold text-white tracking-[-0.02em]">
              Budget
            </h1>
            <div className="flex items-center gap-2 rounded-[10px] p-[7px_14px]" style={{ background: "rgba(255,255,255,0.1)" }}>
              <button onClick={prevMonth}><ChevronLeft className="h-4 w-4 text-white" /></button>
              <span className="text-white text-[13px] font-medium">{monthLabel(viewDate)}</span>
              <button onClick={nextMonth} disabled={mk >= monthKey(now)}>
                <ChevronRight className={`h-4 w-4 text-white ${mk >= monthKey(now) ? "opacity-30" : ""}`} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 mb-3">
            <div>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Income</p>
              <p className="text-[24px] font-bold text-white mt-0.5">
                {totalIncome > 0 ? fmt(totalIncome) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Expenses</p>
              <p className="text-[24px] font-bold text-white mt-0.5">
                {totalExpenses > 0 ? fmt(totalExpenses) : "—"}
              </p>
            </div>
          </div>
          {totalIncome > 0 && (
            <p className="text-sun text-[13px] font-medium">
              Saved {fmt(Math.max(0, saved))} · {savingsRate.toFixed(0)}% rate
            </p>
          )}
        </div>

        {/* Cream content area */}
        <div className="-mx-4 md:-mx-6 bg-paper rounded-t-[24px] -mt-6 p-[22px_16px_0] min-h-full">
        <div className="space-y-4">

        {/* Carry-forward banner */}
        <AnimatePresence>
          {carryPending?.pending && !carryForwardDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex items-center justify-between gap-3 rounded-[16px] p-4 bg-green-tint border border-green/25"
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0 text-green" />
                <p className="text-[13px] font-medium text-green">
                  {carryPending.count} recurring items from {prevMonthName(mk)} — copy them over?
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => carryForward.mutate()} disabled={carryForward.isPending}
                  className="rounded-full transition-colors bg-green text-white text-xs font-semibold px-3.5 py-1.5 min-h-8"
                >
                  {carryForward.isPending ? "…" : "Yes, copy"}
                </button>
                <button onClick={() => setCarryForwardDismissed(true)} className="flex items-center justify-center text-ink-40 min-w-9 min-h-9" aria-label="Dismiss"><X className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => openTxForm("income")}
            className="rounded-[20px] p-4 text-left active:scale-95 transition-transform bg-green-tint border border-green/25"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg"></span>
              <Plus className="h-3.5 w-3.5 text-green" />
            </div>
            <p className="text-[13px] font-semibold text-green">Log Income</p>
            <p className="text-[11px] text-green mt-0.5">Salary, freelance, etc.</p>
          </button>
          <button
            onClick={() => openTxForm("expense")}
            className="rounded-[20px] p-4 text-left active:scale-95 transition-transform bg-clay-tint border border-clay/25"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg"></span>
              <Plus className="h-3.5 w-3.5 text-clay" />
            </div>
            <p className="text-[13px] font-semibold text-clay">Log Expense</p>
            <p className="text-[11px] text-clay mt-0.5">Food, rent, bills, etc.</p>
          </button>
        </div>

        {/* Transaction form (add & edit) */}
        <AnimatePresence>
          {showTxForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-card border border-card-border rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {editingTxId
                    ? (txType === "income" ? "Edit Income" : "Edit Expense")
                    : (txType === "income" ? "Log Income" : "Log Expense")}
                </p>
                <button onClick={closeTxForm} className="flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Close form" style={{ minWidth: 36, minHeight: 36 }}><X className="h-4 w-4" /></button>
              </div>

              <div>
                <input
                  placeholder={txType === "income" ? "e.g. Monthly salary" : "e.g. Grab lunch"}
                  value={txForm.description}
                  onChange={e => {
                    setTxForm(f => ({ ...f, description: e.target.value }));
                    if (txErrors.description) setTxErrors(e => ({ ...e, description: undefined }));
                  }}
                  className={cn(
                    "w-full border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary",
                    txErrors.description ? "border-red-400" : "border-border"
                  )}
                  autoFocus
                />
                {txErrors.description && <p className="text-xs text-red-500 mt-1 ml-1">{txErrors.description}</p>}
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{sym}</span>
                    <input
                      type="number" placeholder="0"
                      value={txForm.amount}
                      onChange={e => {
                        setTxForm(f => ({ ...f, amount: e.target.value }));
                        if (txErrors.amount) setTxErrors(e => ({ ...e, amount: undefined }));
                      }}
                      className={cn(
                        "w-full border rounded-xl pl-8 pr-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary",
                        txErrors.amount ? "border-red-400" : "border-border"
                      )}
                    />
                  </div>
                  {txErrors.amount && <p className="text-xs text-red-500 mt-1 ml-1">{txErrors.amount}</p>}
                </div>
                <input
                  type="date" value={txForm.transactionDate}
                  onChange={e => setTxForm(f => ({ ...f, transactionDate: e.target.value }))}
                  className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {txType === "expense" && (
                <div className="flex flex-wrap gap-2">
                  {TX_CATS.filter(c => c.value !== "income").map(c => (
                    <button key={c.value} onClick={() => setTxForm(f => ({ ...f, category: c.value }))}
                      className={cn("rounded-full px-3 text-xs border transition-colors flex items-center gap-1.5",
                        txForm.category === c.value ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50")}
                      style={{ minHeight: 36 }}>
                      <c.icon className="w-3.5 h-3.5" /> {c.label}
                    </button>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none py-1">
                <div
                  onClick={() => setTxForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
                  className={cn("relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0",
                    txForm.isRecurring ? "bg-primary" : "bg-muted-foreground/30")}
                >
                  <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    txForm.isRecurring ? "translate-x-4" : "translate-x-0.5")} />
                </div>
                <div>
                  <span className="font-medium">Recurring</span>
                  {txForm.isRecurring
                    ? <span className="text-xs text-primary ml-2 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Copies automatically next month</span>
                    : <span className="text-xs text-muted-foreground ml-2">One-off entry</span>}
                </div>
              </label>

              <Button className="w-full" size="sm" onClick={submitTxForm} disabled={isBusy}>
                {isBusy ? "Saving…" : editingTxId ? "Update Transaction" : `Save ${txType === "income" ? "Income" : "Expense"}`}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily / Monthly tab toggle */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(["daily", "monthly"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn("flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize",
                view === v ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {v === "daily" ? "Daily transactions" : "Monthly breakdown"}
            </button>
          ))}
        </div>

        {/* DAILY VIEW */}
        {view === "daily" && (
          <>
            {txLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : grouped.length > 0 ? (
              <div className="space-y-3">
                {grouped.map(([date, txs]) => {
                  const dayIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
                  const dayExpense = txs.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
                  const parsedDate = new Date(date + "T00:00:00");
                  return (
                    <div key={date} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{todayLabel(parsedDate)}</p>
                        <div className="flex gap-3 text-xs">
                          {dayIncome > 0 && <span className="text-emerald-600 font-medium">+{fmt(dayIncome)}</span>}
                          {dayExpense > 0 && <span className="text-red-500 font-medium">-{fmt(dayExpense)}</span>}
                        </div>
                      </div>
                      {txs.map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-t border-border first:border-0">
                          <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-muted/50">
                            {catIcon(tx.category)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate">{tx.description}</p>
                              {tx.isRecurring && (
                                <span className="flex-shrink-0 flex items-center justify-center bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                  <RefreshCw className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{catLabel(tx.category)}</p>
                          </div>
                          <span className={`flex-shrink-0 text-sm font-bold ${tx.type === "income" ? "text-green" : "text-clay"}`}>
                            {tx.type === "income" ? "+" : "-"}{sym}{parseFloat(tx.amount).toLocaleString()}
                          </span>

                          {/* Edit & Delete controls */}
                          {confirmDeleteId === tx.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => deleteTx.mutate(tx.id)}
                                disabled={deleteTx.isPending}
                                className="text-xs text-white font-medium px-2 py-1 rounded-lg bg-clay"
                              >
                                {deleteTx.isPending ? "…" : "Delete"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => openEditForm(tx)}
                                className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                aria-label={`Edit ${tx.description}`}
                                style={{ minWidth: 36, minHeight: 36 }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(tx.id)}
                                className="flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                                aria-label={`Delete ${tx.description}`}
                                style={{ minWidth: 36, minHeight: 36 }}
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
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-2xl mb-2"></p>
                <p className="text-sm font-medium mb-1">No transactions yet for {monthLabel(viewDate)}</p>
                <p className="text-xs text-muted-foreground">Tap "Log Income" or "Log Expense" above to start tracking.</p>
              </div>
            )}
          </>
        )}

        {/* MONTHLY VIEW */}
        {view === "monthly" && (
          <div className="space-y-3">
            {catTotals.length > 0 ? (
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground px-4 pt-3 pb-1 uppercase tracking-wide">Spending by category</p>
                {catTotals.map(c => {
                  const isIncome = c.value === "income";
                  const pct = totalExpenses > 0 && !isIncome ? (c.total / totalExpenses) * 100 : 0;
                  const dotColor = CAT_COLORS[c.value] ?? "var(--ink-40)";
                  const budgetAmt = !isIncome ? (form as any)[c.value] as number ?? 0 : 0;
                  const variance = !isIncome && budgetAmt > 0 ? c.total - budgetAmt : null;
                  return (
                    <div key={c.value} className="p-[12px_18px] border-b border-hairline">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                          <span className="text-[13px] font-medium text-forest">{c.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {variance !== null && (
                            <span className={`text-[11px] font-medium ${variance > 0 ? "text-clay" : "text-green"}`}>
                              {variance > 0 ? `+${sym}${Math.round(variance).toLocaleString()} over` : `-${sym}${Math.abs(Math.round(variance)).toLocaleString()} under`}
                            </span>
                          )}
                          {!isIncome && variance === null && totalExpenses > 0 && (
                            <span className="text-[11px] text-ink-40">{pct.toFixed(0)}%</span>
                          )}
                          <span className={`text-[13px] font-semibold ${isIncome ? "text-green" : "text-forest"}`}>
                            {isIncome ? "+" : ""}{sym}{c.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {!isIncome && (
                        <div className="relative h-1.5 rounded-full bg-hairline overflow-hidden">
                          {budgetAmt > 0 && (
                            <div className="absolute h-full rounded-full bg-track" style={{ width: `${Math.min(100, (budgetAmt / Math.max(budgetAmt, c.total)) * 100)}%` }} />
                          )}
                          <div className="absolute h-full rounded-full" style={{ background: variance !== null && variance > 0 ? "var(--clay)" : dotColor, width: `${Math.min(100, budgetAmt > 0 ? (c.total / Math.max(budgetAmt, c.total)) * 100 : pct)}%`, transition: "width 0.4s ease" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                <p className="text-xs text-muted-foreground">Log transactions to see your monthly breakdown by category.</p>
              </div>
            )}

            {/* Monthly estimates (collapsible) */}
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowEstimates(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <div>
                  <p className="text-sm font-semibold">Monthly budget plan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Set target amounts per category</p>
                </div>
                {showEstimates ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showEstimates && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
                    <div className={cn("border-b border-border", editingIncome && "bg-muted/30")}>
                      <button onClick={() => setEditingIncome(v => !v)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                        <div className="flex items-center gap-3"><span className="text-lg"></span><span className="font-medium text-sm">Income</span></div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold", form.income > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                            {form.income > 0 ? `${sym}${form.income.toLocaleString()}` : "Set amount"}
                          </span>
                          {editingIncome ? <Check className="h-4 w-4 text-primary" /> : <Pencil className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {editingIncome && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="px-4 pb-4"><CurrencyField editable value={form.income} onChange={v => setForm(f => ({ ...f, income: v }))} currency={currency} /></div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {CATS.map((cat) => (
                      <div key={cat.key} className={cn("border-b border-border last:border-0", editingCat === cat.key && "bg-muted/30")}>
                        <button onClick={() => setEditingCat(editingCat === cat.key ? null : cat.key)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                          <div className="flex items-center gap-3"><cat.icon className="w-5 h-5 text-muted-foreground" /><span className="font-medium text-sm">{cat.label}</span></div>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-semibold", form[cat.key] > 0 ? "text-red-500" : "text-muted-foreground")}>
                              {form[cat.key] > 0 ? `${sym}${form[cat.key].toLocaleString()}` : "—"}
                            </span>
                            {editingCat === cat.key ? <Check className="h-4 w-4 text-primary" /> : <Pencil className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>
                        <AnimatePresence>
                          {editingCat === cat.key && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="px-4 pb-4"><CurrencyField editable value={form[cat.key]} onChange={v => setForm(f => ({ ...f, [cat.key]: v }))} currency={currency} /></div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}

                    <div className="px-4 py-3.5">
                      <Button className="w-full" size="sm" onClick={() => saveEstimates.mutate()} disabled={saveEstimates.isPending}>
                        {saveEstimates.isPending ? "Saving…" : "Save budget plan"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
        </div>
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
