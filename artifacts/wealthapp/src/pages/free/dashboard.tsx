import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { queryClient } from "@/lib/queryClient";
import {
  Target, DollarSign, TrendingUp, Heart, Map, ArrowRight, Sparkles
} from "lucide-react";

interface HealthScore { overallScore: number; budgetScore: number; goalsScore: number; netWorthScore: number; }
interface Goal { id: string; title: string; status: string; targetAmount: string | null; currentAmount: string | null; }

export default function FreeDashboard() {
  const { profile } = useProfile();
  const firstName = profile?.fullName?.split(" ")[0] ?? "there";

  const { data: healthScore } = useQuery<HealthScore>({
    queryKey: ["health-score"],
    queryFn: () => apiFetch<HealthScore>("/health-score"),
    retry: false,
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch<Goal[]>("/goals"),
    retry: false,
  });

  const calcScore = useMutation({
    mutationFn: () => apiFetch("/health-score", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["health-score"] }),
  });

  const onTrackGoals = goals.filter(g => g.status === "on_track" || g.status === "achieved").length;
  const scoreColor = !healthScore ? "text-muted-foreground"
    : healthScore.overallScore >= 75 ? "text-green-600" : healthScore.overallScore >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <AppShell>
      <PageHeader
        title={`Welcome back, ${firstName}!`}
        subtitle="Here's your financial overview for today."
        action={
          <Button onClick={() => calcScore.mutate()} disabled={calcScore.isPending} variant="outline">
            <Sparkles className="h-4 w-4 mr-2" />
            {calcScore.isPending ? "Calculating…" : "Refresh Score"}
          </Button>
        }
      />

      {!profile?.onboardingComplete && (
        <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Map className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">Complete your financial pathway</div>
            <div className="text-xs text-muted-foreground mt-0.5">Follow the 6-step pathway to build your financial foundation.</div>
          </div>
          <Link href="/free/pathway">
            <Button size="sm">Start <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Health Score"
          value={healthScore ? `${healthScore.overallScore}/100` : "—"}
          sub={healthScore ? (healthScore.overallScore >= 75 ? "Excellent" : healthScore.overallScore >= 50 ? "Fair" : "Needs Work") : "Not calculated"}
          icon={Heart}
          color="teal"
          className={scoreColor}
        />
        <StatCard label="Active Goals" value={goals.length} sub={`${onTrackGoals} on track`} icon={Target} color="navy" />
        <StatCard label="Budget Score" value={healthScore ? `${healthScore.budgetScore}%` : "—"} sub="Savings efficiency" icon={DollarSign} color="teal" />
        <StatCard label="Net Worth Score" value={healthScore ? `${healthScore.netWorthScore}%` : "—"} sub="Asset health" icon={TrendingUp} color="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">My Goals</h3>
            <Link href="/free/goals"><Button variant="ghost" size="sm" className="text-primary">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
          </div>
          {goals.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No goals yet. Set your first financial goal.</p>
              <Link href="/free/goals"><Button size="sm" className="mt-3">Add Goal</Button></Link>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 3).map(g => {
                const progress = g.targetAmount && g.currentAmount ? (parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100 : 0;
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{g.title}</div>
                      <div className="h-1.5 bg-muted rounded-full mt-1.5">
                        <div className="h-1.5 bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{Math.round(progress)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Track Budget", icon: DollarSign, href: "/free/budget" },
              { label: "Add Goal", icon: Target, href: "/free/goals" },
              { label: "Net Worth", icon: TrendingUp, href: "/free/networth" },
              { label: "Health Score", icon: Heart, href: "/free/health-score" },
            ].map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.label} href={a.href}>
                  <a className="flex items-center gap-2.5 p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">{a.label}</span>
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gradient-to-r from-[#042C53] to-[#0a4a7a] rounded-xl p-6 text-white flex items-center justify-between">
        <div>
          <div className="text-sm text-white/70 font-medium mb-1">Want personalized advisory?</div>
          <div className="font-bold text-lg">Upgrade to Investment Client</div>
          <div className="text-sm text-white/60 mt-1">Get a dedicated advisor, portfolio management, and a custom financial plan.</div>
        </div>
        <Link href="/tools">
          <Button className="bg-[#1D9E75] hover:bg-[#178a65] border-0 shrink-0">Learn More</Button>
        </Link>
      </div>
    </AppShell>
  );
}
