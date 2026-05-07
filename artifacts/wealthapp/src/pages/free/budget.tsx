import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface BudgetEntry { id: string; periodMonth: string; currency: string; income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; savingsActual: string | null; savingsRatePercent: string | null; }

const COLORS = ["#1D9E75", "#042C53", "#f59e0b", "#6366f1", "#ef4444", "#64748b"];

export default function BudgetPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ periodMonth: new Date().toISOString().slice(0, 7), currency: "USD", income: "", housing: "", food: "", transport: "", utilities: "", entertainment: "", other: "" });

  const { data: entries = [], isLoading } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: () => apiFetch<BudgetEntry[]>("/budget"),
  });

  const add = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/budget", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["budget"] }); setOpen(false); toast.success("Budget entry added!"); },
    onError: () => toast.error("Failed to add budget"),
  });

  const latest = entries[entries.length - 1];
  const income = parseFloat(latest?.income ?? "0");
  const expenses = ["housing", "food", "transport", "utilities", "entertainment", "other"].map(k => parseFloat((latest as any)?.[k] ?? "0")).reduce((a, b) => a + b, 0);
  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income * 100).toFixed(1) : "0";

  const pieData = latest ? [
    { name: "Housing", value: parseFloat(latest.housing ?? "0") },
    { name: "Food", value: parseFloat(latest.food ?? "0") },
    { name: "Transport", value: parseFloat(latest.transport ?? "0") },
    { name: "Utilities", value: parseFloat(latest.utilities ?? "0") },
    { name: "Entertainment", value: parseFloat(latest.entertainment ?? "0") },
    { name: "Other", value: parseFloat(latest.other ?? "0") },
  ].filter(d => d.value > 0) : [];

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <AppShell>
      <PageHeader
        title="Budget Tracker"
        subtitle="Track your monthly income and expenses."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Month</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Budget Entry</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Month</Label><Input type="month" value={form.periodMonth} onChange={f("periodMonth")} /></div>
                  <div><Label>Currency</Label>
                    <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {["USD", "SGD", "MYR", "THB", "IDR", "PHP"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label>Monthly Income</Label><Input type="number" placeholder="5000" value={form.income} onChange={f("income")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Housing</Label><Input type="number" placeholder="1200" value={form.housing} onChange={f("housing")} /></div>
                  <div><Label>Food</Label><Input type="number" placeholder="600" value={form.food} onChange={f("food")} /></div>
                  <div><Label>Transport</Label><Input type="number" placeholder="200" value={form.transport} onChange={f("transport")} /></div>
                  <div><Label>Utilities</Label><Input type="number" placeholder="150" value={form.utilities} onChange={f("utilities")} /></div>
                  <div><Label>Entertainment</Label><Input type="number" placeholder="300" value={form.entertainment} onChange={f("entertainment")} /></div>
                  <div><Label>Other</Label><Input type="number" placeholder="200" value={form.other} onChange={f("other")} /></div>
                </div>
                <Button className="w-full" onClick={() => add.mutate(form)} disabled={add.isPending}>{add.isPending ? "Saving…" : "Save Budget"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {latest ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <DollarSign className="h-5 w-5 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold">{latest.currency} {income.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Income</div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <TrendingDown className="h-5 w-5 text-red-500 mx-auto mb-1" />
              <div className="text-lg font-bold">{latest.currency} {expenses.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Expenses</div>
            </div>
            <div className={`bg-card border rounded-xl p-4 text-center ${savings >= 0 ? "border-primary/30" : "border-red-300"}`}>
              <TrendingUp className={`h-5 w-5 mx-auto mb-1 ${savings >= 0 ? "text-primary" : "text-red-500"}`} />
              <div className={`text-lg font-bold ${savings >= 0 ? "text-primary" : "text-red-500"}`}>{latest.currency} {savings.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Savings ({savingsRate}%)</div>
            </div>
          </div>

          {pieData.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${latest.currency} ${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="font-semibold mb-4">Categories</h3>
                <div className="space-y-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm flex-1">{d.name}</span>
                      <span className="text-sm font-medium">{((d.value / expenses) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : !isLoading && (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">No budget entries yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Start tracking your monthly income and expenses.</p>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add First Month</Button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">History</h3>
          <div className="space-y-2">
            {entries.slice().reverse().map(e => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{e.periodMonth}</span>
                <span className="text-sm text-muted-foreground">{e.currency} {parseFloat(e.income ?? "0").toLocaleString()} income</span>
                <span className={`text-sm font-medium ${parseFloat(e.savingsActual ?? "0") >= 0 ? "text-primary" : "text-red-500"}`}>{e.savingsRatePercent}% saved</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
