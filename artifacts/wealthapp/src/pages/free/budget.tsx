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
import { ChevronLeft, ChevronRight, Pencil, Check, Plus, Trash2, X, RefreshCw } from "lucide-react";
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
function prevMonthLabel(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return d.toLocaleDateString("en-US", { month: "long" });
}

export default function BudgetPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";
  const sym = currency === "VND" ? "₫" : "$";

  const [viewDate, setViewDate] = useState(now);
  const [editingIncome, setEditingIncome] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetForm>({ income: 0, housing: 0, food: 0, transport: 0, utilities: 0, entertainment: 0, other: 0 });
  const [showTxForm, setShowTxForm] = useState(false);
  const [carryForwardDismissed, setCarryForwardDismissed] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>({
    description: "", amount: "", type: "expense", category: "other",
    transactionDate: new Date().toISOString().slice(0, 10), isRecurring: false,
  });

  const { data: entries = [], isLoading } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
  });

  const mk = monthKey(viewDate);
  const entry = entries.find(e => e.periodMonth.startsWith(mk));

  const { data: transactions = [], refetch: refetchTx } = useQuery<BudgetTransaction[]>({
    queryKey: ["budget-transactions", mk],
    queryFn: () => apiFetch<BudgetTransaction[]>(`/budget/transactions?month=${mk}`),
  });

  const { data: carryPending } = useQuery<{ pending: boolean; count: number; prevMonth: string; recurringItems: BudgetTransaction[] }>({
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

  const save = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ periodMonth: mk, currency, income: String(form.income), housing: String(form.housing), food: String(form.food), transport: String(form.transport), utilities: String(form.utilities), entertainment: String(form.entertainment), other: String(form.other) });
      if (entry?.id) {
        return apiFetch(`/budget/${entry.id}`, { method: "PUT", body });
      }
      return apiFetch("/budget", { method: "POST", body });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budget"] }); toast.success("Budget saved!"); },
    onError: () => toast.error("Failed to save budget"),
  });

  const addTx = useMutation({
    mutationFn: () => {
      const isIncome = txForm.type === "income" || txForm.category === "income";
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
      setTxForm({ description: "", amount: "", type: "expense", category: "other", transactionDate: new Date().toISOString().slice(0, 10), isRecurring: false });
      toast.success("Transaction added");
    },
    onError: () => toast.error("Failed to add transaction"),
  });

  const deleteTx = useMutation({
    mutationFn: (id: string) => apiFetch(`/budget/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budget-transactions", mk] }); toast.success("Removed"); },
  });

  const carryForward = useMutation({
    mutationFn: () => apiFetch("/budget/transactions/carry-forward", { method: "POST", body: JSON.stringify({ targetMonth: mk }) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["budget-transactions", mk] });
      queryClient.invalidateQueries({ queryKey: ["budget-carry-pending", mk] });
      setCarryForwardDismissed(true);
      toast.success(`${data.copied} recurring items copied`);
    },
  });

  const income = form.income;
  const totalExp = CATS.reduce((s, c) => s + form[c.key], 0);
  const savings = income - totalExp;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const needsPct = income > 0 ? ((form.housing + form.food + form.transport) / income * 100) : 0;
  const wantsPct = income > 0 ? ((form.entertainment + form.other) / income * 100) : 0;

  const prevMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); };
  const nextMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); if (d <= now) setViewDate(d); };

  const fmt = (n: number) => n >= 0 ? `${sym}${n.toLocaleString()}` : `-${sym}${Math.abs(n).toLocaleString()}`;
  const fmtAmt = (amount: string, type: string) => {
    const n = parseFloat(amount);
    const isInc = type === "income";
    return `${isInc ? "+" : "-"}${sym}${Math.abs(n).toLocaleString()}`;
  };

  const catEmoji = (cat: string) => TX_CATS.find(c => c.value === cat)?.emoji ?? "📦";
  const catLabel = (cat: string) => TX_CATS.find(c => c.value === cat)?.label ?? cat;

  if (isLoading) return (
    <AppShell>
      <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      <BottomNav />
    </AppShell>
  );

  if (!entry && income === 0 && !entries.length) {
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
          <h1 className="text-xl font-bold">Monthly Budget</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:border-primary transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium px-2 min-w-[110px] text-center">{monthLabel(viewDate)}</span>
            <button onClick={nextMonth} disabled={monthKey(viewDate) >= monthKey(now)} className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:border-primary transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Carry-forward banner */}
        <AnimatePresence>
          {carryPending?.pending && !carryForwardDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="bg-primary/5 border border-primary/30 rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <RefreshCw className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-medium">{carryPending.count} recurring items</span> copied from {prevMonthLabel(mk)} — anything change?
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" className="h-7 text-xs px-3" onClick={() => carryForward.mutate()} disabled={carryForward.isPending}>
                  {carryForward.isPending ? "…" : "Looks good"}
                </Button>
                <button onClick={() => setCarryForwardDismissed(true)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode 1 label */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mode 1 — Quick monthly entry</p>

        {/* Income card */}
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Monthly income</p>
            <button onClick={() => setEditingIncome(v => !v)} className="text-muted-foreground hover:text-primary transition-colors">
              {editingIncome ? <Check className="h-4 w-4 text-primary" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>
          {editingIncome
            ? <CurrencyInput value={form.income} onChange={v => setForm(f => ({ ...f, income: v }))} currency={currency} />
            : <p className="text-3xl font-bold text-primary">{fmt(form.income)}</p>}
        </div>

        {/* Rate pills */}
        {income > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Needs", pct: needsPct, color: "text-blue-600 bg-blue-50" },
              { label: "Wants", pct: wantsPct, color: "text-purple-600 bg-purple-50" },
              { label: "Savings", pct: savingsRate, color: savingsRate > 20 ? "text-primary bg-primary/10" : savingsRate > 10 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50" },
            ].map(p => (
              <div key={p.label} className={cn("rounded-xl px-3 py-2.5 text-center", p.color)}>
                <p className="text-lg font-bold">{p.pct.toFixed(0)}%</p>
                <p className="text-xs font-medium">{p.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Expense categories */}
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          {CATS.map((cat) => (
            <div key={cat.key} className={cn("border-b border-border last:border-0", editingCat === cat.key && "bg-muted/30")}>
              <button onClick={() => setEditingCat(editingCat === cat.key ? null : cat.key)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                <div className="flex items-center gap-3"><span className="text-lg">{cat.emoji}</span><span className="font-medium text-sm">{cat.label}</span></div>
                <span className={cn("text-sm font-semibold transition-colors", form[cat.key] > 0 ? "text-primary" : "text-muted-foreground")}>
                  {fmt(form[cat.key])}
                </span>
              </button>
              <AnimatePresence>
                {editingCat === cat.key && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-4">
                      <CurrencyInput value={form[cat.key]} onChange={v => setForm(f => ({ ...f, [cat.key]: v }))} currency={currency} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3.5 bg-muted/30">
            <span className="font-semibold text-sm">Total expenses</span>
            <span className="font-bold text-sm">{fmt(totalExp)}</span>
          </div>
        </div>

        {/* Net savings */}
        {income > 0 && (
          <div className={cn("rounded-2xl p-4 flex items-center justify-between", savings >= 0 ? "bg-primary/5 border border-primary/20" : "bg-red-50 border border-red-200")}>
            <div>
              <p className="text-xs text-muted-foreground">Saved this month</p>
              <p className={cn("text-2xl font-bold", savings >= 0 ? "text-primary" : "text-red-500")}>{fmt(Math.abs(savings))}{savings < 0 ? " overspent" : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Savings rate</p>
              <p className={cn("text-2xl font-bold", savingsRate >= 20 ? "text-primary" : savingsRate >= 10 ? "text-amber-500" : "text-red-500")}>{savingsRate.toFixed(0)}%</p>
            </div>
          </div>
        )}

        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save budget"}
        </Button>

        {/* ── Mode 2: Transaction log ─────────────────────────────────────── */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mode 2 — Transaction log <span className="normal-case font-normal">(optional)</span></p>
            <button onClick={() => setShowTxForm(v => !v)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              <Plus className="h-3.5 w-3.5" />Add
            </button>
          </div>

          {/* Add transaction form */}
          <AnimatePresence>
            {showTxForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-card border border-card-border rounded-2xl p-4 mb-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">New transaction</p>
                  <button onClick={() => setShowTxForm(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>
                <input
                  placeholder="Description (e.g. Grab lunch)"
                  value={txForm.description}
                  onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <div className="flex rounded-xl border border-border overflow-hidden flex-shrink-0">
                    {[{ val: "expense", label: "−" }, { val: "income", label: "+" }].map(t => (
                      <button key={t.val} onClick={() => setTxForm(f => ({ ...f, type: t.val, category: t.val === "income" ? "income" : "other" }))}
                        className={cn("px-4 py-2.5 text-sm font-bold transition-colors", txForm.type === t.val ? (t.val === "income" ? "bg-primary text-white" : "bg-red-500 text-white") : "text-muted-foreground hover:bg-muted")}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number" placeholder="Amount" value={txForm.amount}
                    onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                {txForm.type === "expense" && (
                  <select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary">
                    {TX_CATS.filter(c => c.value !== "income").map(c => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                )}
                <input type="date" value={txForm.transactionDate} onChange={e => setTxForm(f => ({ ...f, transactionDate: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary" />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={txForm.isRecurring} onChange={e => setTxForm(f => ({ ...f, isRecurring: e.target.checked }))} className="rounded" />
                  <span className="text-muted-foreground">Recurring monthly</span>
                  {txForm.isRecurring && <span className="text-xs text-primary font-medium">Auto-copies next month</span>}
                </label>
                <Button className="w-full" size="sm" onClick={() => addTx.mutate()} disabled={!txForm.description || !txForm.amount || addTx.isPending}>
                  {addTx.isPending ? "Adding…" : "Add transaction"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transaction list */}
          {transactions.length > 0 ? (
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
              {transactions.map((tx, i) => (
                <div key={tx.id} className={cn("flex items-center gap-3 px-4 py-3 border-b border-border last:border-0", i % 2 === 0 ? "" : "bg-muted/10")}>
                  <span className="text-lg flex-shrink-0">{catEmoji(tx.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      {tx.isRecurring && <span className="flex-shrink-0 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">↻</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{catLabel(tx.category)} · {new Date(tx.transactionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  <span className={cn("text-sm font-semibold flex-shrink-0", tx.type === "income" ? "text-primary" : "text-red-500")}>
                    {fmtAmt(tx.amount, tx.type)}
                  </span>
                  <button onClick={() => deleteTx.mutate(tx.id)} className="text-muted-foreground hover:text-red-500 transition-colors ml-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground">
                Transactions auto-add to category totals above.
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center">
              <p className="text-sm text-muted-foreground">No transactions logged yet</p>
              <button onClick={() => setShowTxForm(true)} className="text-xs text-primary font-medium mt-1">Tap + Add to log one</button>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
