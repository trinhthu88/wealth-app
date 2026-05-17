import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import HealthScoreRing from "@/components/HealthScoreRing";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface HealthScore { overallScore: number; budgetScore: number; goalsScore: number; savingsScore: number; netWorthScore?: number; scoreDate: string; insights: Record<string, number> | null; }

const BREAKDOWN = [
  { key: "budgetScore" as const, label: "Budget health", desc: "Based on your savings rate", icon: "💰" },
  { key: "goalsScore" as const, label: "Goals progress", desc: "Based on your financial goal", icon: "🎯" },
  { key: "savingsScore" as const, label: "Net worth", desc: "Your financial snapshot", icon: "📈" },
  { key: "goalsScore" as const, label: "Plan completion", desc: "Pathway steps complete", icon: "🗺️" },
];

function ScoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", color: "text-primary" };
  if (score >= 65) return { label: "Good", color: "text-primary" };
  if (score >= 50) return { label: "Fair", color: "text-amber-500" };
  return { label: "Needs Work", color: "text-red-500" };
}

function insightBorderColor(text: string) {
  if (/great|excellent|on track|ahead/i.test(text)) return "border-green-400 bg-green-50";
  if (/consider|improve|could|might/i.test(text)) return "border-amber-400 bg-amber-50";
  return "border-red-400 bg-red-50";
}

export default function HealthScorePage() {
  const { data: score, isLoading } = useQuery<HealthScore>({
    queryKey: ["health-score"],
    queryFn: () => apiFetch<HealthScore>("/health-score"),
    retry: false,
  });

  const { data: history = [] } = useQuery<HealthScore[]>({
    queryKey: ["health-score-history"],
    queryFn: () => apiFetch<HealthScore[]>("/health-score/history").catch(() => []),
    retry: false,
  });

  const calculate = useMutation({
    mutationFn: () => apiFetch<HealthScore>("/health-score", { method: "POST" }),
    onSuccess: (data) => { queryClient.setQueryData(["health-score"], data); toast.success("Health score updated!"); },
    onError: () => toast.error("Failed to calculate score"),
  });

  const overall = score?.overallScore ?? 0;
  const { label: scoreLabel, color: scoreColor } = ScoreLabel(overall);

  const insights = score?.insights
    ? Object.entries(score.insights).map(([k, v]) => {
        if (k === "savingsRate") return `Your savings rate is ${Number(v).toFixed(0)}% — ${Number(v) >= 20 ? "excellent work!" : Number(v) >= 10 ? "consider increasing to 20%" : "try to reach 10% first"}`;
        if (k === "completedSteps") return `You've completed ${v} of 6 plan steps — ${Number(v) >= 5 ? "almost there!" : "keep going to boost your score"}`;
        if (k === "goalsOnTrack") return `${v} goal${Number(v) !== 1 ? "s" : ""} on track — ${Number(v) > 0 ? "great progress!" : "set a goal to improve your score"}`;
        return null;
      }).filter(Boolean)
    : [];

  const chartData = history.length > 1 ? history.map(h => ({ score: h.overallScore, date: h.scoreDate })) : null;

  if (isLoading) return (
    <AppShell>
      <div className="space-y-4 pb-20">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn("bg-muted animate-pulse rounded-2xl", i === 0 ? "h-48" : "h-24")} />)}</div>
      <BottomNav />
    </AppShell>
  );

  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-5">
        {/* Hero card */}
        <motion.div
          className="bg-[#042C53] rounded-2xl p-6 text-center"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-center mb-3">
            <HealthScoreRing score={overall} size="lg" animate darkMode />
          </div>
          <p className="text-4xl font-bold text-white mt-2">{overall}</p>
          <p className="text-sm text-blue-200 mt-1">Financial Health Score</p>
          <p className={cn("text-sm font-semibold mt-1", overall >= 65 ? "text-green-300" : overall >= 40 ? "text-amber-300" : "text-red-300")}>{scoreLabel}</p>
          <Button size="sm" variant="outline" className="mt-4 border-white/20 text-white hover:bg-white/10 gap-1.5" onClick={() => calculate.mutate()} disabled={calculate.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5", calculate.isPending && "animate-spin")} />
            {calculate.isPending ? "Calculating…" : "Recalculate"}
          </Button>
        </motion.div>

        {/* Score breakdown */}
        {score && (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Score breakdown</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Budget health", icon: "💰", score: score.budgetScore, desc: "Based on savings rate" },
                  { label: "Goals progress", icon: "🎯", score: score.goalsScore, desc: "Based on your goal" },
                  { label: "Plan completion", icon: "🗺️", score: score.savingsScore, desc: "Pathway steps done" },
                  { label: "Net worth", icon: "📈", score: score.netWorthScore ?? score.savingsScore, desc: "Your financial snapshot" },
                ].map(b => (
                  <motion.div key={b.label} className="bg-card border border-card-border rounded-2xl p-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{b.icon}</span>
                      <p className="text-xs text-muted-foreground">{b.label}</p>
                    </div>
                    <p className="text-xl font-bold">{b.score ?? 0}<span className="text-sm font-normal text-muted-foreground">/25</span></p>
                    <Progress value={((b.score ?? 0) / 25) * 100} className="h-1.5 mt-2 mb-1" />
                    <p className="text-xs text-muted-foreground">{b.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Your insights</p>
              {insights.length > 0 ? (
                <div className="space-y-2">
                  {insights.map((text, i) => (
                    <div key={i} className={cn("border-l-4 rounded-xl p-4 text-sm", insightBorderColor(text ?? ""))}>
                      {text}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/50 rounded-2xl p-6 text-center">
                  <p className="text-muted-foreground text-sm">Complete your financial plan to see personalised insights</p>
                </div>
              )}
            </div>

            {/* Score history */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Score history</p>
              {chartData ? (
                <div className="bg-card border border-card-border rounded-2xl p-4">
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={chartData}>
                      <Tooltip formatter={(v) => [`${v}`, "Score"]} labelFormatter={(l) => new Date(l).toLocaleDateString("en-US", { month: "short" })} />
                      <Line type="monotone" dataKey="score" stroke="#1D9E75" strokeWidth={2} dot={{ fill: "#1D9E75", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-2xl p-5 text-center">
                  <p className="text-muted-foreground text-sm">Check back next month to see your trend</p>
                </div>
              )}
            </div>
          </>
        )}

        {!score && (
          <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📊</p>
            <h3 className="font-semibold mb-2">No score yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Complete your financial pathway to generate your health score.</p>
            <Button onClick={() => calculate.mutate()} disabled={calculate.isPending}>
              {calculate.isPending ? "Calculating…" : "Calculate my score"}
            </Button>
          </div>
        )}
      </div>
      <BottomNav />
    </AppShell>
  );
}
