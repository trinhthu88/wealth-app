import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import GoalCard from "@/components/GoalCard";
import CurrencyInput from "@/components/CurrencyInput";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { Lock, X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { Link } from "wouter";

interface Goal { id: string; title: string; goalType: string; targetAmount: string | null; currentAmount: string | null; monthlyContribution: string | null; targetDate: string | null; currency: string; priority: string; status: string; }

export default function GoalsPage() {
  const { profile } = useProfile();
  const currency = profile?.preferredCurrency ?? "USD";
  const [contributeOpen, setContributeOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch<Goal[]>("/goals"),
  });

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

  const topGoal = goals[0];

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
          <p className="text-muted-foreground text-sm max-w-xs">A clear goal is the foundation of every great financial plan.</p>
          <Link href="/free/pathway"><Button>Set a goal in 2 minutes →</Button></Link>
        </div>
        <BottomNav />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-4">
        <div className="px-0.5">
          <h1 className="text-xl font-bold">Financial Goals</h1>
          <p className="text-sm text-muted-foreground">Track progress toward your milestones</p>
        </div>

        {/* Primary goal */}
        {topGoal && (
          <GoalCard
            goal={topGoal}
            onContribute={() => setContributeOpen(true)}
          />
        )}

        {/* Locked: extra goals */}
        <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center">
          <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="font-medium text-muted-foreground text-sm">Add another goal</p>
          <p className="text-xs text-muted-foreground mt-1">Upgrade to Premium to unlock unlimited goals</p>
          <Button variant="outline" size="sm" className="mt-4 text-xs">Explore Premium →</Button>
        </div>

        {/* All goals (if advisor added more) */}
        {goals.slice(1).map(goal => (
          <GoalCard key={goal.id} goal={goal} onContribute={() => setContributeOpen(true)} />
        ))}
      </div>

      {/* Contribution Modal */}
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
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Monthly savings" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <Button className="w-full mt-5" disabled={amount <= 0 || addContribution.isPending} onClick={() => addContribution.mutate(topGoal)}>
                {addContribution.isPending ? "Saving…" : "Save contribution"}
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </AppShell>
  );
}
