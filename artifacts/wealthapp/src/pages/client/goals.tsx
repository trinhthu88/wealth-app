import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import CurrencyInput from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Target, Pencil, Trash2, X, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { fmtCurrency } from "@/lib/portfolioCalculations";

interface Goal {
  id: string;
  title: string;
  goalType: string | null;
  targetAmount: string | null;
  currentAmount: string | null;
  monthlyContribution: string | null;
  targetDate: string | null;
  status: string;
  priority: number | null;
}

const GOAL_TYPES = [
  { id: "retire", label: "Retire comfortably", emoji: "🌴" },
  { id: "property", label: "Buy property", emoji: "🏠" },
  { id: "education", label: "Education", emoji: "📚" },
  { id: "fire", label: "Financial independence", emoji: "🚀" },
  { id: "business", label: "Business", emoji: "💼" },
  { id: "emigrate", label: "Emigrate", emoji: "🌍" },
  { id: "wealth", label: "Build wealth", emoji: "💰" },
  { id: "early_retire", label: "Retire early", emoji: "🎓" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "emergency", label: "Emergency fund", emoji: "🛡️" },
  { id: "other", label: "Other", emoji: "🎯" },
];

function getEmoji(type: string | null) {
  return GOAL_TYPES.find((t) => t.id === type)?.emoji ?? "🎯";
}

function statusInfo(goal: Goal) {
  const target = parseFloat(goal.targetAmount ?? "0");
  const current = parseFloat(goal.currentAmount ?? "0");
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  if (pct >= 100) return { label: "Complete!", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2, barColor: "bg-emerald-500" };
  if (pct >= 60) return { label: "On track", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2, barColor: "bg-emerald-500" };
  if (pct >= 30) return { label: "Almost there", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: Clock, barColor: "bg-amber-500" };
  return { label: "Getting started", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: AlertCircle, barColor: "bg-primary" };
}

interface GoalFormState {
  title: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  targetDate: string;
}

const emptyForm = (): GoalFormState => ({ title: "", goalType: "", targetAmount: 0, currentAmount: 0, monthlyContribution: 0, targetDate: "" });

export default function ClientGoalsPage() {
  const qc = useQueryClient();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalFormState>(emptyForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch("/goals"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/goals", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal added!");
      setShowAddSheet(false);
      setForm(emptyForm());
    },
    onError: () => toast.error("Failed to add goal"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiFetch(`/goals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal updated!");
      setEditGoal(null);
    },
    onError: () => toast.error("Failed to update goal"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/goals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal removed");
      setDeleteConfirm(null);
    },
    onError: () => toast.error("Failed to remove goal"),
  });

  function openEdit(g: Goal) {
    setForm({
      title: g.title,
      goalType: g.goalType ?? "",
      targetAmount: parseFloat(g.targetAmount ?? "0"),
      currentAmount: parseFloat(g.currentAmount ?? "0"),
      monthlyContribution: parseFloat(g.monthlyContribution ?? "0"),
      targetDate: g.targetDate ?? "",
    });
    setEditGoal(g);
  }

  function submitForm() {
    if (!form.title) { toast.error("Goal name is required"); return; }
    const payload = {
      title: form.title,
      goalType: form.goalType || null,
      targetAmount: form.targetAmount > 0 ? String(form.targetAmount) : null,
      currentAmount: form.currentAmount > 0 ? String(form.currentAmount) : null,
      monthlyContribution: form.monthlyContribution > 0 ? String(form.monthlyContribution) : null,
      targetDate: form.targetDate || null,
      priority: editGoal ? editGoal.priority : goals.length + 1,
    };
    if (editGoal) {
      updateMut.mutate({ id: editGoal.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending;

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-4 pb-20">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="My Goals"
        subtitle={goals.length > 0 ? `${goals.length} financial goal${goals.length !== 1 ? "s" : ""} · click any to edit` : "Set your financial targets"}
      />

      <div className="space-y-4 pb-28 md:pb-6">
        {goals.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-6">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">Set a clear goal with a target amount and date — it's the foundation of your investment plan.</p>
            <Button onClick={() => { setForm(emptyForm()); setShowAddSheet(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add your first goal
            </Button>
          </motion.div>
        ) : (
          <>
            {goals.map((g, i) => {
              const target = parseFloat(g.targetAmount ?? "0");
              const current = parseFloat(g.currentAmount ?? "0");
              const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
              const info = statusInfo(g);
              const StatusIcon = info.icon;
              return (
                <motion.div key={g.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <div className={`rounded-2xl border p-5 ${info.bg}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getEmoji(g.goalType)}</span>
                        <div>
                          <h3 className="font-semibold text-base">{g.title}</h3>
                          {g.goalType && (
                            <span className="text-xs text-muted-foreground capitalize">{GOAL_TYPES.find(t => t.id === g.goalType)?.label ?? g.goalType}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg hover:bg-white/60 text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(g.id)} className="p-1.5 rounded-lg hover:bg-white/60 text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {target > 0 && (
                      <>
                        <div className="flex items-end justify-between mb-2">
                          <div>
                            <div className="text-2xl font-bold text-navy">{fmtCurrency(current)}</div>
                            <div className="text-xs text-muted-foreground">of {fmtCurrency(target)} target</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{Math.round(pct)}%</div>
                            <div className={`flex items-center gap-1 text-xs ${info.color}`}>
                              <StatusIcon className="h-3.5 w-3.5" /> {info.label}
                            </div>
                          </div>
                        </div>
                        <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                          <motion.div className={`h-full ${info.barColor} rounded-full`}
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} />
                        </div>
                      </>
                    )}

                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                      {g.targetDate && <span>Target: {g.targetDate.slice(0, 7)}</span>}
                      {g.monthlyContribution && parseFloat(g.monthlyContribution) > 0 && (
                        <span>{fmtCurrency(parseFloat(g.monthlyContribution))}/month</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <button onClick={() => { setForm(emptyForm()); setShowAddSheet(true); }}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-border text-sm text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/40 hover:text-primary transition-all">
              <Plus className="h-4 w-4" /> Add another goal
            </button>
          </>
        )}
      </div>

      {/* Add / Edit sheet */}
      <AnimatePresence>
        {(showAddSheet || editGoal) && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowAddSheet(false); setEditGoal(null); }} />
            <motion.div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 p-6 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold">{editGoal ? "Edit goal" : "New goal"}</h3>
                <button onClick={() => { setShowAddSheet(false); setEditGoal(null); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Goal name</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Retirement fund" />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Goal type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {GOAL_TYPES.map((t) => (
                      <button key={t.id} onClick={() => setForm(f => ({ ...f, goalType: t.id }))}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all ${form.goalType === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                        <span className="text-xl">{t.emoji}</span>
                        <span className="text-center leading-tight">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <CurrencyInput value={form.targetAmount} onChange={v => setForm(f => ({ ...f, targetAmount: v }))} currency="USD" label="Target amount" />
                <CurrencyInput value={form.currentAmount} onChange={v => setForm(f => ({ ...f, currentAmount: v }))} currency="USD" label="Current amount saved" />
                <CurrencyInput value={form.monthlyContribution} onChange={v => setForm(f => ({ ...f, monthlyContribution: v }))} currency="USD" label="Monthly contribution (target)" />

                <div>
                  <label className="text-sm font-medium block mb-1.5">Target date</label>
                  <Input type="month" value={form.targetDate ? form.targetDate.slice(0, 7) : ""}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value ? e.target.value + "-01" : "" }))} />
                </div>
              </div>

              <Button className="w-full mt-6" onClick={submitForm} disabled={isBusy || !form.title}>
                {isBusy ? "Saving…" : editGoal ? "Save changes" : "Add goal"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)} />
            <motion.div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 p-6 pb-10 shadow-2xl"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
              <div className="text-center space-y-4">
                <div className="text-3xl">🗑️</div>
                <h3 className="text-lg font-semibold">Remove this goal?</h3>
                <p className="text-sm text-muted-foreground">This will permanently delete the goal and its progress data.</p>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                  <Button variant="destructive" className="flex-1" disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(deleteConfirm!)}>
                    {deleteMut.isPending ? "Removing…" : "Remove goal"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
