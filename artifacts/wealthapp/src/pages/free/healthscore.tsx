import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import HealthScoreRing from "@/components/HealthScoreRing";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface HealthScore {
  overallScore: number;
  budgetScore: number;
  goalsScore: number;
  netWorthScore: number | null;
  savingsScore: number;
  scoreDate: string;
  insights: Record<string, unknown> | null;
}
interface Pathway { stepNumber: number; status: string; }

function ScoreLabel(score: number) {
  if (score >= 80) return { label: "Excellent", color: "text-green-300" };
  if (score >= 65) return { label: "Good", color: "text-green-300" };
  if (score >= 50) return { label: "Fair", color: "text-amber-300" };
  return { label: "Needs Work", color: "text-red-300" };
}

function insightBorderColor(text: string) {
  if (/on track|ahead|positive|grew|great|excellent/i.test(text)) return "border-green-400 bg-green-50";
  if (/setting|unlock|attention|focus|shortfall/i.test(text)) return "border-amber-400 bg-amber-50";
  return "border-blue-400 bg-blue-50";
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

  const { data: pathway = [] } = useQuery<Pathway[]>({
    queryKey: ["pathway"],
    queryFn: () => apiFetch<Pathway[]>("/pathway"),
    retry: false,
  });

  const calculate = useMutation({
    mutationFn: () => apiFetch<HealthScore>("/health-score", { method: "POST" }),
    onSuccess: (data) => { queryClient.setQueryData(["health-score"], data); toast.success("Health score updated!"); },
    onError: () => toast.error("Failed to calculate score"),
  });

  const overall = score?.overallScore ?? 0;
  const { label: scoreLabel, color: scoreColor } = ScoreLabel(overall);
  const completedSteps = pathway.filter(s => s.status === "completed").length;

  const savingsScore = score?.savingsScore ?? 0;
  const goalsScore = score?.goalsScore ?? 0;
  const netWorthScore = score?.netWorthScore ?? 0;
  const planScore = Math.round((completedSteps / 6) * 10);
  const wealthGrowthScore = Math.max(0, Math.min(20, overall - savingsScore - goalsScore - netWorthScore - planScore));

  const breakdown = [
    {
      label: "Effective savings rate",
      icon: "💰",
      score: savingsScore,
      maxScore: 25,
      desc: savingsScore >= 20 ? "Excellent savings discipline" : savingsScore >= 12 ? "Good — keep pushing to 20%" : "Focus on increasing savings rate",
    },
    {
      label: "Goal on-track status",
      icon: "🎯",
      score: goalsScore,
      maxScore: 25,
      desc: goalsScore >= 20 ? "Your goal is on track" : goalsScore >= 10 ? "Set a target date to boost this" : "Set a goal with a target date",
    },
    {
      label: "Net worth trend",
      icon: "📈",
      score: netWorthScore,
      maxScore: 20,
      desc: netWorthScore >= 15 ? "Net worth growing well" : netWorthScore >= 8 ? "Positive net worth" : "Focus on reducing debts",
    },
    {
      label: "Wealth growth rate",
      icon: "🚀",
      score: wealthGrowthScore,
      maxScore: 20,
      desc: wealthGrowthScore >= 16 ? "Strong wealth growth" : wealthGrowthScore >= 10 ? "Moderate growth" : "Invest to grow faster",
    },
    {
      label: "Plan completion",
      icon: "🗺️",
      score: planScore,
      maxScore: 10,
      desc: completedSteps >= 6 ? "Plan complete!" : `${completedSteps} of 6 steps done`,
    },
  ];

  const insights = (() => {
    if (!score?.insights) return [];
    const raw = score.insights as Record<string, unknown>;
    const out: string[] = [];
    const sr = typeof raw.savingsRate === "number" ? raw.savingsRate : 0;
    const steps = typeof raw.completedSteps === "number" ? raw.completedSteps : 0;
    const onTrack = typeof raw.goalsOnTrack === "number" ? raw.goalsOnTrack : 0;
    if (sr > 0) out.push(`Your savings rate is ${sr.toFixed(0)}% — ${sr >= 20 ? "excellent, you're in the top tier!" : sr >= 10 ? "consider pushing to 20% for maximum score" : "try reaching 10% as the first milestone"}`);
    out.push(`You've completed ${steps} of 6 plan steps — ${steps >= 5 ? "almost there!" : steps >= 3 ? "keep going, each step boosts your score" : "complete more steps to improve your score"}`);
    out.push(`${onTrack} goal${onTrack !== 1 ? "s" : ""} on track — ${onTrack > 0 ? "great progress! Stay consistent." : "set a goal with a target date to unlock 25 more points"}`);
    return out;
  })();

  const chartData = history.length > 1
    ? history.map(h => ({ score: h.overallScore, date: h.scoreDate }))
    : null;

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
        <motion.div className="bg-[#042C53] rounded-2xl p-6 text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-center mb-3">
            <HealthScoreRing score={overall} size="lg" animate darkMode />
          </div>
          <p className="text-4xl font-bold text-white mt-2">{overall}</p>
          <p className="text-sm text-blue-200 mt-1">Financial Health Score</p>
          <p className={cn("text-sm font-semibold mt-1", scoreColor)}>{scoreLabel}</p>
          <Button size="sm" variant="outline" className="mt-4 border-white/20 text-white hover:bg-white/10 gap-1.5" onClick={() => calculate.mutate()} disabled={calculate.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5", calculate.isPending && "animate-spin")} />
            {calculate.isPending ? "Calculating…" : "Recalculate"}
          </Button>
        </motion.div>

        {/* 5-component breakdown */}
        {score && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">Score breakdown</p>
            <div className="grid grid-cols-2 gap-3">
              {breakdown.map((b, i) => (
                <motion.div
                  key={b.label}
                  className={cn("bg-card border border-card-border rounded-2xl p-4", i === 4 && "col-span-2")}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base">{b.icon}</span>
                    <span className="text-xs text-muted-foreground">{b.maxScore} pts max</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{b.label}</p>
                  <p className="text-xl font-bold">{b.score}<span className="text-sm font-normal text-muted-foreground">/{b.maxScore}</span></p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2 mb-1">
                    <div
                      className={cn("h-full rounded-full transition-all", b.score / b.maxScore >= 0.8 ? "bg-primary" : b.score / b.maxScore >= 0.5 ? "bg-amber-500" : "bg-red-400")}
                      style={{ width: `${(b.score / b.maxScore) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {score && insights.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">Personalised insights</p>
            <div className="space-y-2">
              {insights.map((text, i) => (
                <div key={i} className={cn("border-l-4 rounded-xl p-4 text-sm", insightBorderColor(text))}>
                  {text}
                </div>
              ))}
            </div>
          </div>
        )}

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
