import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import HealthScoreRing from "@/components/HealthScoreRing";
import SmartUpgradeCard from "@/components/SmartUpgradeCard";
import GoalCard from "@/components/GoalCard";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { Map, X, ChevronRight, Phone } from "lucide-react";

interface HealthScore { overallScore: number; budgetScore: number; goalsScore: number; savingsScore: number; insights: Record<string, number> | null; }
interface Goal { id: string; title: string; goalType: string; status: string; targetAmount: string | null; currentAmount: string | null; currency: string; targetDate?: string | null; }
interface BudgetEntry { income: string | null; housing: string | null; food: string | null; transport: string | null; utilities: string | null; entertainment: string | null; other: string | null; }
interface Asset { id: string; valueUsd: string; category: string; }
interface Liability { id: string; balanceUsd: string; }
interface Pathway { stepNumber: number; status: string; }

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function FreeDashboard() {
  const { profile } = useProfile();
  const [pathwayDismissed, setPathwayDismissed] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const firstName = profile?.fullName?.split(" ")[0] ?? "there";

  const { data: score } = useQuery<HealthScore>({ queryKey: ["health-score"], queryFn: () => apiFetch<HealthScore>("/health-score"), retry: false });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["goals"], queryFn: () => apiFetch<Goal[]>("/goals"), retry: false });
  const { data: budgets = [] } = useQuery<BudgetEntry[]>({ queryKey: ["budget"], queryFn: () => apiFetch<BudgetEntry[]>("/budget"), retry: false });
  const { data: pathway = [] } = useQuery<Pathway[]>({ queryKey: ["pathway"], queryFn: () => apiFetch<Pathway[]>("/pathway"), retry: false });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["assets"], queryFn: () => apiFetch<Asset[]>("/assets"), retry: false });
  const { data: liabilities = [] } = useQuery<Liability[]>({ queryKey: ["liabilities"], queryFn: () => apiFetch<Liability[]>("/liabilities"), retry: false });

  const budget = budgets[budgets.length - 1];
  const income = parseFloat(budget?.income ?? "0");
  const expenses = (["housing", "food", "transport", "utilities", "entertainment", "other"] as const)
    .reduce((s, k) => s + parseFloat((budget as any)?.[k] ?? "0"), 0);
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
  const completedSteps = pathway.filter(s => s.status === "completed").length;
  const pathwayPct = (completedSteps / 6) * 100;
  const totalAssets = assets.reduce((s, a) => s + parseFloat(a.valueUsd ?? "0"), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + parseFloat(l.balanceUsd ?? "0"), 0);
  const netWorth = (assets.length > 0 || liabilities.length > 0) ? totalAssets - totalLiabilities : null;
  const topGoal = goals[0];
  const goalPct = topGoal && parseFloat(topGoal.targetAmount ?? "0") > 0
    ? Math.min(100, Math.round(parseFloat(topGoal.currentAmount ?? "0") / parseFloat(topGoal.targetAmount ?? "1") * 100))
    : 0;

  const checkin = useMutation({
    mutationFn: () => apiFetch("/notifications", { method: "POST", body: JSON.stringify({ type: "checkin" }) }).catch(() => {}),
    onSuccess: () => { setStreak(s => s + 1); toast.success(`🔥 ${streak + 1} week streak!`); setCheckinOpen(false); },
    onError: () => { setStreak(s => s + 1); toast.success(`🔥 ${streak + 1} week streak!`); setCheckinOpen(false); },
  });

  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-4">
        <div className="px-0.5 pt-0.5">
          <h1 className="text-xl font-bold">Welcome back, {firstName}! 👋</h1>
          <p className="text-sm text-muted-foreground">Here's your financial overview</p>
        </div>

        {/* Pathway banner */}
        <AnimatePresence>
          {!pathwayDismissed && !profile?.onboardingComplete && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="bg-emerald-50 border border-primary/20 rounded-2xl p-4 relative overflow-hidden"
            >
              <button onClick={() => setPathwayDismissed(true)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-3 pr-6">
                <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Map className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Your plan is {Math.round(pathwayPct)}% complete</p>
                  <Progress value={pathwayPct} className="h-1.5 mt-1.5 mb-2.5" />
                  <Link href="/free/pathway">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      Continue setup <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Health Score Card */}
        <Link href="/free/health-score">
          <div className="bg-card border border-card-border rounded-2xl p-5 flex items-center gap-5 cursor-pointer hover:border-primary/40 transition-colors">
            <HealthScoreRing score={score?.overallScore ?? 0} size="md" animate />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Financial Health Score</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl font-bold text-primary">{score?.overallScore ?? 0}</span>
                <span className="text-muted-foreground text-sm">/100</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {!score
                  ? "Complete your plan to see your score"
                  : score.overallScore >= 70 ? "Great work! Keep it up 🎉"
                  : score.overallScore >= 40 ? "Making progress ✓"
                  : "Let's improve together"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </Link>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/free/budget">
            <div className="bg-card border border-card-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors h-full">
              <p className="text-xs text-muted-foreground">Savings rate</p>
              <p className={`text-2xl font-bold mt-1 ${income > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                {income > 0 ? `${savingsRate.toFixed(0)}%` : "—"}
              </p>
              <p className={`text-xs mt-1 font-medium ${savingsRate > 20 ? "text-green-600" : savingsRate > 10 ? "text-amber-500" : income > 0 ? "text-red-500" : "text-primary"}`}>
                {income > 0
                  ? savingsRate > 20 ? "On track ✓" : savingsRate > 10 ? "Almost there" : "Needs attention"
                  : "Set up budget →"}
              </p>
            </div>
          </Link>

          <div className="bg-card border border-card-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Net worth</p>
            <p className={`text-2xl font-bold mt-1 ${netWorth !== null ? (netWorth >= 0 ? "text-primary" : "text-red-500") : "text-muted-foreground"}`}>
              {netWorth !== null ? fmt(netWorth) : "—"}
            </p>
            <p className={`text-xs mt-1 font-medium ${netWorth !== null ? (netWorth >= 0 ? "text-primary" : "text-red-500") : "text-primary"}`}>
              {netWorth !== null ? (netWorth >= 0 ? "↑ Growing" : "↓ Check debts") : "Track assets →"}
            </p>
          </div>

          <Link href="/free/goals">
            <div className="bg-card border border-card-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors">
              <p className="text-xs text-muted-foreground">Top goal</p>
              <p className="text-sm font-semibold mt-1 truncate">{topGoal?.title ?? "No goal set"}</p>
              {topGoal
                ? (<><Progress value={goalPct} className="h-1.5 mt-2 mb-1" /><p className="text-xs text-muted-foreground">{goalPct}% complete</p></>)
                : <p className="text-xs text-primary mt-1 font-medium">Set your first goal →</p>}
            </div>
          </Link>

          <div className="bg-card border border-card-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setCheckinOpen(true)}>
            <p className="text-xs text-muted-foreground">Check-in streak</p>
            <p className="text-2xl font-bold mt-1">{streak > 0 ? `${streak}` : "0"} {streak > 0 ? "🔥" : ""}</p>
            <p className="text-xs text-primary mt-1 font-medium">Tap to check in</p>
          </div>
        </div>

        {/* Smart Upgrade Cards */}
        <SmartUpgradeCard
          condition={income > 0 && savingsRate < 15}
          insightText={`You're saving ${savingsRate.toFixed(0)}% — reaching 20% could move your retirement forward by 2+ years`}
          ctaText="Book a free discovery call"
          ctaType="savings_rate"
        />
        <SmartUpgradeCard
          condition={goals.length > 0 && assets.filter(a => a.category === "investment").length === 0 && income > 0 && savingsRate >= 15}
          insightText="Your goal needs an investment strategy — an advisor can build your personalised roadmap"
          ctaText="Book a free discovery call"
          ctaType="no_investments"
        />
        <SmartUpgradeCard
          condition={(profile?.isExpat ?? false) && income > 0}
          insightText="As an expat, you may be missing tax and pension optimisations worth thousands per year"
          ctaText="Book a free discovery call"
          ctaType="expat"
        />

        {/* Top Goal Card (if exists) */}
        {topGoal && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Your main goal</p>
            <GoalCard goal={topGoal} onContribute={() => window.location.href = "/free/goals"} />
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Quick actions</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { icon: "📊", label: "Update budget", href: "/free/budget" },
              { icon: "🎯", label: "Add goal", href: "/free/goals" },
              { icon: "📈", label: "Net worth", href: "/free/networth" },
            ].map(a => (
              <Link key={a.href} href={a.href}>
                <div className="flex items-center gap-1.5 whitespace-nowrap bg-muted hover:bg-muted/80 rounded-full px-4 py-2 text-sm border border-border cursor-pointer transition-colors">
                  <span>{a.icon}</span><span>{a.label}</span>
                </div>
              </Link>
            ))}
            <a href="/book" className="flex items-center gap-1.5 whitespace-nowrap bg-muted hover:bg-muted/80 rounded-full px-4 py-2 text-sm border border-border transition-colors">
              <Phone className="h-3.5 w-3.5" /><span>Book a call</span>
            </a>
          </div>
        </div>
      </div>

      {/* Weekly Checkin Modal */}
      <AnimatePresence>
        {checkinOpen && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCheckinOpen(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 p-6 pb-10 md:hidden shadow-2xl"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <h3 className="text-xl font-semibold">Weekly check-in 🔥</h3>
              <p className="text-muted-foreground text-sm mt-1">Keeps your streak alive · 30 seconds</p>
              <div className="space-y-3 mt-6">
                <Button className="w-full" onClick={() => checkin.mutate()} disabled={checkin.isPending}>
                  Yes, I stayed on track this week ✓
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setCheckinOpen(false)}>
                  Skipped this week
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </AppShell>
  );
}
