import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import CurrencyInput from "@/components/CurrencyInput";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Check, Plus, Trash2, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { Link } from "wouter";

interface BudgetEntry { id?: string; periodMonth: string; currency: string; income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface BudgetTransaction { id: string; periodMonth: string; description: string; amount: string; type: string; category: string; transactionDate: string; isRecurring: boolean; }

const CATS = [
  { key: "housing" as const, emoji: "🏠", label: "Housing" },
  { key: "food" as const, emoji: "🍜", label: "Food" },
  { key: "transport" as const, emoji: "🚗", label: "Transport" },
  { key: "utilities" as const, emoji: "💡", label: "Utilities" },
  { key: "entertainment" as const, emoji: "🎮", label: "Entertainment" },
  { key: "other" as const, emoji: "📦", label: "Other" },
];

const TX_CATS = [
  { value: "income", label: "Income", emoji: "💵" },
  { value: "housing", label: "Housing", emoji: "🏠" },
  { value: "food", label: "Food", emoji: "🍜" },
  { value: "transport", label: "Transport", emoji: "🚗" },
  { value: "utilities", label: "Utilities", emoji: "💡" },
  { value: "entertainment", label: "Entertainment", emoji: "🎮" },
  { value: "other", label: "Other", emoji: "📦" },
];

type BudgetForm = { income: number; housing: number; food: number; transport: number; utilities: number; entertainment: number; other: number; };
type TxForm = { description: string; amount: string; type: string; category: string; transactionDate: string; isRecurring: boolean; };

const now = new Date();
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function prevMonthName(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 2, 1).toLocaleDateString("en-US", { month: "long" });
}

export default function BudgetPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";
  const sym = currency === "VND" ? "₫" : "$";

  const [viewDate, setViewDate] = useState(now);
  const [showTxForm, setShowTxForm] = useState(false);
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [carryForwardDismissed, setCarryForwardDismissed] = useState(false);
  const [showEstimates, setShowEstimates] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetForm>({ income: 0, housing: 0, food: 0, transport: 0, utilities: 0, entertainment: 0, other: 0 });

  const defaultTxDate = new Date().toISOString().slice(0, 10);
  const [txForm, setTxForm] = useState<TxForm>({
    description: "", amount: "", type: "expense", category: "other",
    transactionDate: defaultTxDate, isRecurring: false,
  });

  const mk = monthKey(viewDate);

  const { data: entries = [], isLoading } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
  });

  const entry = entries.find(e => e.periodMonth.startsWith(mk));

  const { data: transactions = [] } = useQuery<BudgetTransaction[]>({
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
      setShowTxForm(false);
      setTxForm({ description: "", amount: "", type: txType, category: "other", transactionDate: defaultTxDate, isRecurring: false });
      toast.success(txType === "income" ? "Income logged!" : "Expense logged!");
    },
    onError: () => toast.error("Failed to log transaction"),
  });

  const deleteTx = useMutation({
    mutationFn: (id: string) => apiFetch(`/budget/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budget-transactions", mk] }); },
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

  // Totals — from both transactions and estimates
  const txIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const txExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const estIncome = form.income;
  const estExpenses = CATS.reduce((s, c) => s + form[c.key], 0);

  const totalIncome = txIncome > 0 ? txIncome : estIncome;
  const totalExpenses = txExpenses > 0 ? txExpenses : estExpenses;
  const saved = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (saved / totalIncome) * 100 : 0;

  const prevMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); };
  const nextMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); if (d <= now) setViewDate(d); };

  const fmt = (n: number) => `${sym}${Math.abs(n).toLocaleString()}`;
  const catEmoji = (cat: string) => TX_CATS.find(c => c.value === cat)?.emoji ?? "📦";
  const catLabel = (cat: string) => TX_CATS.find(c => c.value === cat)?.label ?? cat;

  function openTxForm(type: "income" | "expense") {
    setTxType(type);
    setTxForm({ description: "", amount: "", type, category: type === "income" ? "income" : "other", transactionDate: defaultTxDate, isRecurring: false });
    setShowTxForm(true);
  }

  if (isLoading) return (
    <AppShell>
      <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      <BottomNav />
    </AppShell>
  );

  const hasNoData = !entry && transactions.length === 0;
  if (hasNoData && !entries.length) {
    return (
      <AppShell>
        <div className="pb-20 md:pb-0 flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
          <span className="text-5xl">📊</span>
          <h2 className="text-xl font-semibold">Set up your budget</h2>
          <p className="text-muted-foreground text-sm max-w-xs">Track your monthly income and expenses to understand your savings rate.</p>
          <Link href="/free/pathway"><Button>Start budget setup →</Button></Link>
        </div>
        <BottomNav />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Budget</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:border-primary transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium px-2 min-w-[110px] text-center">{monthLabel(viewDate)}</span>
            <button onClick={nextMonth} disabled={mk >= monthKey(now)} className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:border-primary transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Carry-forward banner */}
        <AnimatePresence>
          {carryPending?.pending && !carryForwardDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="bg-primary/5 border border-primary/30 rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <RefreshCw className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">
                  {carryPending.count} recurring items from {prevMonthName(mk)} — copy them over?
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" className="h-7 text-xs px-3" onClick={() => carryForward.mutate()} disabled={carryForward.isPending}>
                  {carryForward.isPending ? "…" : "Yes, copy"}
                </Button>
                <button onClick={() => setCarryForwardDismissed(true)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Monthly summary */}
        <div className="bg-[#042C53] rounded-2xl p-4 text-white">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-blue-200 text-xs">Income</p>
              <p className="text-white font-bold text-lg">{fmt(totalIncome)}</p>
              {txIncome > 0 && estIncome > 0 && txIncome !== estIncome && <p className="text-blue-300 text-xs">est. {fmt(estIncome)}</p>}
            </div>
            <div>
              <p className="text-blue-200 text-xs">Expenses</p>
              <p className="text-white font-bold text-lg">{fmt(totalExpenses)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs">Saved</p>
              <p className={cn("font-bold text-lg", saved >= 0 ? "text-emerald-300" : "text-red-300")}>{saved >= 0 ? fmt(saved) : `-${fmt(saved)}`}</p>
            </div>
          </div>
          {totalIncome > 0 && (
            <div>
              <div className="flex justify-between text-xs text-blue-200 mb-1">
                <span>Savings rate</span>
                <span className={savingsRate >= 20 ? "text-emerald-300 font-semibold" : savingsRate >= 10 ? "text-amber-300" : "text-red-300"}>{savingsRate.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", savingsRate >= 20 ? "bg-emerald-400" : savingsRate >= 10 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => openTxForm("income")}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">💵</span>
              <Plus className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">Log Income</p>
            <p className="text-xs text-emerald-600 mt-0.5">Salary, freelance, etc.</p>
          </button>
          <button
            onClick={() => openTxForm("expense")}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 text-left hover:border-red-400 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🧾</span>
              <Plus className="h-3.5 w-3.5 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-red-600">Log Expense</p>
            <p className="text-xs text-red-500 mt-0.5">Food, rent, bills, etc.</p>
          </button>
        </div>

        {/* Add transaction form */}
        <AnimatePresence>
          {showTxForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-card border border-card-border rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{txType === "income" ? "💵 Log Income" : "🧾 Log Expense"}</p>
                <button onClick={() => setShowTxForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>

              <input
                placeholder={txType === "income" ? "e.g. Monthly salary" : "e.g. Grab lunch"}
                value={txForm.description}
                onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{sym}</span>
                  <input
                    type="number" placeholder="0"
                    value={txForm.amount}
                    onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border border-border rounded-xl pl-8 pr-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                  />
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
                      className={cn("rounded-full px-3 py-1 text-xs border transition-colors flex items-center gap-1",
                        txForm.category === c.value ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                      {c.emoji} {c.label}
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
                    ? <span className="text-xs text-primary ml-2">↻ Copies automatically next month</span>
                    : <span className="text-xs text-muted-foreground ml-2">One-off entry</span>}
                </div>
              </label>

              <Button className="w-full" size="sm" onClick={() => addTx.mutate()}
                disabled={!txForm.description || !txForm.amount || parseFloat(txForm.amount) <= 0 || addTx.isPending}>
                {addTx.isPending ? "Saving…" : `Save ${txType === "income" ? "Income" : "Expense"}`}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction log */}
        {transactions.length > 0 ? (
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <p className="text-xs font-medium text-muted-foreground px-4 pt-3 pb-1 uppercase tracking-wide">This month's log</p>
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-t border-border first:border-0">
                <span className="text-lg flex-shrink-0">{catEmoji(tx.category)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    {tx.isRecurring && (
                      <span className="flex-shrink-0 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">↻</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {catLabel(tx.category)} · {new Date(tx.transactionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <span className={cn("text-sm font-semibold flex-shrink-0", tx.type === "income" ? "text-emerald-600" : "text-red-500")}>
                  {tx.type === "income" ? "+" : "-"}{sym}{parseFloat(tx.amount).toLocaleString()}
                </span>
                <button onClick={() => deleteTx.mutate(tx.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center">
            <p className="text-sm text-muted-foreground mb-1">No transactions logged for {monthLabel(viewDate)}</p>
            <p className="text-xs text-muted-foreground">Use "Log Income" and "Log Expense" above to track your money.</p>
          </div>
        )}

        {/* Monthly estimates (collapsible) */}
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowEstimates(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
          >
            <div>
              <p className="text-sm font-semibold">Monthly estimates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Set category totals manually (used when no transactions logged)</p>
            </div>
            {showEstimates ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showEstimates && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
                {/* Income row */}
                <div className={cn("border-b border-border", editingIncome && "bg-muted/30")}>
                  <button onClick={() => setEditingIncome(v => !v)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                    <div className="flex items-center gap-3"><span className="text-lg">💵</span><span className="font-medium text-sm">Income</span></div>
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
                        <div className="px-4 pb-4"><CurrencyInput value={form.income} onChange={v => setForm(f => ({ ...f, income: v }))} currency={currency} /></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {CATS.map((cat) => (
                  <div key={cat.key} className={cn("border-b border-border last:border-0", editingCat === cat.key && "bg-muted/30")}>
                    <button onClick={() => setEditingCat(editingCat === cat.key ? null : cat.key)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                      <div className="flex items-center gap-3"><span className="text-lg">{cat.emoji}</span><span className="font-medium text-sm">{cat.label}</span></div>
                      <span className={cn("text-sm font-semibold", form[cat.key] > 0 ? "text-red-500" : "text-muted-foreground")}>
                        {form[cat.key] > 0 ? `${sym}${form[cat.key].toLocaleString()}` : "—"}
                      </span>
                    </button>
                    <AnimatePresence>
                      {editingCat === cat.key && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4"><CurrencyInput value={form[cat.key]} onChange={v => setForm(f => ({ ...f, [cat.key]: v }))} currency={currency} /></div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}

                <div className="px-4 py-3.5">
                  <Button className="w-full" size="sm" onClick={() => saveEstimates.mutate()} disabled={saveEstimates.isPending}>
                    {saveEstimates.isPending ? "Saving…" : "Save estimates"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
