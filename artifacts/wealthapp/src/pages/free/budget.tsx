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
import { ChevronLeft, ChevronRight, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { Link } from "wouter";

interface BudgetEntry { id?: string; periodMonth: string; currency: string; income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }

const CATS = [
  { key: "housing" as const, emoji: "🏠", label: "Housing" },
  { key: "food" as const, emoji: "🍜", label: "Food" },
  { key: "transport" as const, emoji: "🚗", label: "Transport" },
  { key: "utilities" as const, emoji: "💡", label: "Utilities" },
  { key: "entertainment" as const, emoji: "🎮", label: "Entertainment" },
  { key: "other" as const, emoji: "📦", label: "Other" },
];

type BudgetForm = { income: number; housing: number; food: number; transport: number; utilities: number; entertainment: number; other: number; };

const now = new Date();
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }

export default function BudgetPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";
  const sym = currency === "VND" ? "₫" : "$";

  const [viewDate, setViewDate] = useState(now);
  const [editingIncome, setEditingIncome] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetForm>({ income: 0, housing: 0, food: 0, transport: 0, utilities: 0, entertainment: 0, other: 0 });

  const { data: entries = [], isLoading } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
  });

  const mk = monthKey(viewDate);
  const entry = entries.find(e => e.periodMonth.startsWith(mk));

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
  }, [entry]);

  const save = useMutation({
    mutationFn: () => apiFetch("/budget", { method: "POST", body: JSON.stringify({ periodMonth: mk, currency, income: String(form.income), housing: String(form.housing), food: String(form.food), transport: String(form.transport), utilities: String(form.utilities), entertainment: String(form.entertainment), other: String(form.other) }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budget"] }); toast.success("Budget saved!"); },
    onError: () => toast.error("Failed to save budget"),
  });

  const income = form.income;
  const totalExp = CATS.reduce((s, c) => s + form[c.key], 0);
  const savings = income - totalExp;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  const needsPct = income > 0 ? ((form.housing + form.food + form.transport) / income * 100) : 0;
  const wantsPct = income > 0 ? ((form.entertainment + form.other) / income * 100) : 0;

  const prevMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); };
  const nextMonth = () => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); if (d <= now) setViewDate(d); };

  const fmt = (n: number) => n > 0 ? `${sym}${n.toLocaleString()}` : `${sym}0`;

  if (isLoading) return <AppShell><div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div><BottomNav /></AppShell>;

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
        {/* Header with month nav */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Monthly Budget</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:border-primary transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium px-2 min-w-[110px] text-center">{monthLabel(viewDate)}</span>
            <button onClick={nextMonth} disabled={monthKey(viewDate) >= monthKey(now)} className="h-8 w-8 flex items-center justify-center rounded-full border border-border hover:border-primary transition-colors disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

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

        {/* Savings rate pills */}
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
          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-muted/30">
            <span className="font-semibold text-sm">Total expenses</span>
            <span className="font-bold text-sm">{fmt(totalExp)}</span>
          </div>
        </div>

        {/* Net savings */}
        {income > 0 && (
          <div className={cn("rounded-2xl p-4 flex items-center justify-between", savings >= 0 ? "bg-primary/5 border border-primary/20" : "bg-red-50 border border-red-200")}>
            <div>
              <p className="text-xs text-muted-foreground">Monthly savings</p>
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
      </div>
      <BottomNav />
    </AppShell>
  );
}
