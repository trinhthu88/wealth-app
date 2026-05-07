import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Heart, RefreshCw, TrendingUp, DollarSign, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { toast } from "sonner";

interface HealthScore { overallScore: number; budgetScore: number; goalsScore: number; netWorthScore: number; savingsScore: number; scoreDate: string; insights: { savingsRate?: number; completedSteps?: number; goalsOnTrack?: number; } | null; }

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "#1D9E75" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="text-center">
      <div className="relative h-20 w-20 mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={[{ value: score, fill: color }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "hsl(var(--muted))" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function HealthScorePage() {
  const { data: score, isLoading } = useQuery<HealthScore>({
    queryKey: ["health-score"],
    queryFn: () => apiFetch<HealthScore>("/health-score"),
    retry: false,
  });

  const calculate = useMutation({
    mutationFn: () => apiFetch<HealthScore>("/health-score", { method: "POST" }),
    onSuccess: (data) => { queryClient.setQueryData(["health-score"], data); toast.success("Health score updated!"); },
    onError: () => toast.error("Failed to calculate score"),
  });

  const overall = score?.overallScore ?? 0;
  const scoreLabel = overall >= 80 ? "Excellent" : overall >= 65 ? "Good" : overall >= 50 ? "Fair" : "Needs Work";
  const scoreColor = overall >= 80 ? "text-green-600" : overall >= 65 ? "text-primary" : overall >= 50 ? "text-amber-500" : "text-red-500";

  const tips = [
    { condition: (score?.budgetScore ?? 0) < 60, tip: "Increase your savings rate to at least 20% of income.", icon: DollarSign },
    { condition: (score?.goalsScore ?? 0) < 50, tip: "Set 2-3 clear financial goals and track them monthly.", icon: Target },
    { condition: (score?.netWorthScore ?? 0) < 50, tip: "Reduce high-interest liabilities to improve your net worth.", icon: TrendingUp },
    { condition: overall < 50, tip: "Complete your financial pathway steps to build a solid foundation.", icon: Heart },
  ].filter(t => t.condition);

  return (
    <AppShell>
      <PageHeader
        title="Financial Health Score"
        subtitle="Your personalized financial wellness indicator."
        action={<Button onClick={() => calculate.mutate()} disabled={calculate.isPending}><RefreshCw className={cn("h-4 w-4 mr-2", calculate.isPending && "animate-spin")} />{calculate.isPending ? "Calculating…" : "Recalculate"}</Button>}
      />

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-60 bg-muted rounded-xl" />
          <div className="h-40 bg-muted rounded-xl" />
        </div>
      ) : !score ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <Heart className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Health Score Yet</h3>
          <p className="text-muted-foreground text-sm mb-5">Calculate your first financial health score based on your data.</p>
          <Button onClick={() => calculate.mutate()} disabled={calculate.isPending}><RefreshCw className="h-4 w-4 mr-2" />Calculate Now</Button>
        </div>
      ) : (
        <>
          <div className="bg-card border border-card-border rounded-xl p-8 text-center mb-6">
            <div className="relative h-44 w-44 mx-auto mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="90%" data={[{ value: overall }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted))" }}
                    fill={overall >= 80 ? "#1D9E75" : overall >= 65 ? "#1D9E75" : overall >= 50 ? "#f59e0b" : "#ef4444"} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-5xl font-extrabold", scoreColor)}>{overall}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>
            <div className={cn("text-2xl font-bold", scoreColor)}>{scoreLabel}</div>
            <div className="text-sm text-muted-foreground mt-1">Last updated: {new Date(score.scoreDate).toLocaleDateString()}</div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
            <h3 className="font-semibold mb-5">Score Breakdown</h3>
            <div className="grid grid-cols-4 gap-4">
              <ScoreGauge score={score.budgetScore} label="Budget" />
              <ScoreGauge score={score.goalsScore} label="Goals" />
              <ScoreGauge score={score.netWorthScore} label="Net Worth" />
              <ScoreGauge score={score.savingsScore} label="Savings" />
            </div>
          </div>

          {score.insights && (
            <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3">Key Metrics</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                {score.insights.savingsRate !== undefined && (
                  <div><div className="text-2xl font-bold text-primary">{score.insights.savingsRate.toFixed(0)}%</div><div className="text-xs text-muted-foreground">Savings Rate</div></div>
                )}
                {score.insights.completedSteps !== undefined && (
                  <div><div className="text-2xl font-bold text-primary">{score.insights.completedSteps}/6</div><div className="text-xs text-muted-foreground">Pathway Steps</div></div>
                )}
                {score.insights.goalsOnTrack !== undefined && (
                  <div><div className="text-2xl font-bold text-primary">{score.insights.goalsOnTrack}</div><div className="text-xs text-muted-foreground">Goals On Track</div></div>
                )}
              </div>
            </div>
          )}

          {tips.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Recommendations</h3>
              <div className="space-y-3">
                {tips.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                      <Icon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">{t.tip}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
