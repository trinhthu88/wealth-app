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
import { Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Goal { id: string; title: string; goalType: string; targetAmount: string | null; currentAmount: string | null; monthlyContribution: string | null; targetDate: string | null; currency: string; priority: string; status: string; }

const GOAL_TYPES = ["emergency_fund", "retirement", "home_purchase", "education", "travel", "vehicle", "business", "debt_payoff", "other"];
const STATUS_COLORS: Record<string, string> = { on_track: "bg-green-100 text-green-700", at_risk: "bg-amber-100 text-amber-700", off_track: "bg-red-100 text-red-700", achieved: "bg-primary/15 text-primary", paused: "bg-muted text-muted-foreground" };

export default function GoalsPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", goalType: "emergency_fund", targetAmount: "", currentAmount: "0", monthlyContribution: "", targetDate: "", currency: "USD", priority: "medium", status: "on_track" });

  const { data: goals = [], isLoading } = useQuery<Goal[]>({ queryKey: ["goals"], queryFn: () => apiFetch<Goal[]>("/goals") });

  const add = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/goals", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); setOpen(false); toast.success("Goal added!"); setForm({ title: "", goalType: "emergency_fund", targetAmount: "", currentAmount: "0", monthlyContribution: "", targetDate: "", currency: "USD", priority: "medium", status: "on_track" }); },
    onError: () => toast.error("Failed to add goal"),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); toast.success("Goal removed"); },
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <AppShell>
      <PageHeader
        title="Financial Goals"
        subtitle="Track progress toward your financial milestones."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Goal</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>New Financial Goal</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Goal Title</Label><Input placeholder="Emergency Fund" value={form.title} onChange={f("title")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <select value={form.goalType} onChange={f("goalType")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {GOAL_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div><Label>Currency</Label>
                    <select value={form.currency} onChange={f("currency")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {["USD", "SGD", "MYR", "THB", "IDR", "PHP"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Target Amount</Label><Input type="number" placeholder="10000" value={form.targetAmount} onChange={f("targetAmount")} /></div>
                  <div><Label>Current Amount</Label><Input type="number" placeholder="0" value={form.currentAmount} onChange={f("currentAmount")} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Monthly Contribution</Label><Input type="number" placeholder="500" value={form.monthlyContribution} onChange={f("monthlyContribution")} /></div>
                  <div><Label>Target Date</Label><Input type="date" value={form.targetDate} onChange={f("targetDate")} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority</Label>
                    <select value={form.priority} onChange={f("priority")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {["low", "medium", "high"].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><Label>Status</Label>
                    <select value={form.status} onChange={f("status")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {["on_track", "at_risk", "off_track", "paused"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                </div>
                <Button className="w-full" onClick={() => add.mutate(form)} disabled={!form.title || add.isPending}>{add.isPending ? "Saving…" : "Add Goal"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}</div>
        : goals.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl p-16 text-center">
            <Target className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No goals yet</h3>
            <p className="text-muted-foreground text-sm mb-5">Define your financial milestones and track your progress.</p>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Set Your First Goal</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {goals.map(g => {
              const target = parseFloat(g.targetAmount ?? "0");
              const current = parseFloat(g.currentAmount ?? "0");
              const progress = target > 0 ? (current / target) * 100 : 0;
              const monthsLeft = g.monthlyContribution && parseFloat(g.monthlyContribution) > 0 && target > current
                ? Math.ceil((target - current) / parseFloat(g.monthlyContribution)) : null;

              return (
                <div key={g.id} className="bg-card border border-card-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">{g.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{g.goalType.replace(/_/g, " ")} · {g.priority} priority</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[g.status] ?? "bg-muted text-muted-foreground")}>{g.status.replace(/_/g, " ")}</span>
                      <button onClick={() => del.mutate(g.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end justify-between text-sm mb-1.5">
                    <span className="font-bold text-xl text-primary">{g.currency} {current.toLocaleString()}</span>
                    <span className="text-muted-foreground">{g.currency} {target.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full mb-2">
                    <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{Math.round(progress)}% complete</span>
                    {monthsLeft && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{monthsLeft} months to go</span>}
                    {g.targetDate && <span>{new Date(g.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </AppShell>
  );
}
