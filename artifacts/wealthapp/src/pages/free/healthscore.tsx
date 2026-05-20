import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import HealthScoreRing from "@/components/HealthScoreRing";
import BenchmarkCard from "@/components/BenchmarkCard";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";
import { RefreshCw, ChevronRight } from "lucide-react";
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

  // Auto-calculate if no score yet
  useEffect(() => {
    if (!isLoading && !score && !calculate.isPending) {
      calculate.mutate();
    }
  }, [isLoading, score]);

  const overall = score?.overallScore ?? 0;
  const { label: scoreLabel, color: scoreColor } = ScoreLabel(overall);
  const completedSteps = pathway.filter(s => s.status === "completed").length;

  const savingsScore = score?.savingsScore ?? 0;
  const goalsScore = score?.goalsScore ?? 0;
  const netWorthScore = score?.netWorthScore ?? 0;
  const planScore = Math.min(10, Math.round((completedSteps / 6) * 10));
  // Read wealthGrowthScore stored in insights by the API (avoids arithmetic reconstruction)
  const insights_raw = score?.insights as Record<string, unknown> | null;
  const wealthGrowthScore = typeof insights_raw?.wealthGrowthScore === "number"
    ? insights_raw.wealthGrowthScore
    : Math.max(0, Math.min(20, overall - savingsScore - goalsScore - netWorthScore - planScore));

  const effectiveSavingsRate = typeof insights_raw?.effectiveSavingsRate === "number" ? insights_raw.effectiveSavingsRate : 0;

  // Each card has a label, score, maxScore, description, edit link, and edit label
  const breakdown = [
    {
      label: "Effective savings rate",
      icon: "💰",
      score: savingsScore,
      maxScore: 25,
      desc: savingsScore >= 20 ? "Excellent savings discipline" : savingsScore >= 12 ? "Good — keep pushing to 20%" : "Focus on increasing savings rate",
      editHref: "/free/budget",
      editLabel: "Update budget",
      tip: savingsScore < 25 ? "Log your income & expenses to improve this score" : undefined,
    },
    {
      label: "Goal on-track status",
      icon: "🎯",
      score: goalsScore,
      maxScore: 25,
      desc: goalsScore >= 20 ? "Your goal is on track" : goalsScore >= 10 ? "Set a target date to boost this" : "Set a goal with a target date",
      editHref: "/free/pathway?step=4",
      editLabel: "Edit goal",
      tip: goalsScore < 25 ? "Set a goal target date so we can calculate your pace" : undefined,
    },
    {
      label: "Net worth trend",
      icon: "📈",
      score: netWorthScore,
      maxScore: 20,
      desc: netWorthScore >= 15 ? "Net worth growing well" : netWorthScore >= 8 ? "Positive net worth" : "Focus on reducing debts",
      editHref: "/free/pathway?step=5",
      editLabel: "Update assets",
      tip: netWorthScore < 20 ? "Add your savings, investments and debts in Step 5" : undefined,
    },
    {
      label: "Wealth growth rate",
      icon: "🚀",
      score: wealthGrowthScore,
      maxScore: 20,
      desc: wealthGrowthScore >= 16 ? "Strong wealth growth" : wealthGrowthScore >= 10 ? "Moderate growth" : "Invest to grow faster",
      editHref: "/free/pathway?step=5",
      editLabel: "Update rates",
      tip: wealthGrowthScore < 20 ? "Add your savings & investment interest rates in Step 5" : undefined,
    },
    {
      label: "Plan completion",
      icon: "🗺️",
      score: planScore,
      maxScore: 10,
      desc: completedSteps >= 6 ? "Plan complete!" : `${completedSteps} of 6 steps done`,
      editHref: "/free/pathway",
      editLabel: "Continue plan",
      tip: completedSteps < 6 ? `${6 - completedSteps} step${6 - completedSteps !== 1 ? "s" : ""} remaining — each adds points` : undefined,
    },
  ];

  const insights = (() => {
    if (!score?.insights) return [];
    const raw = score.insights as Record<string, unknown>;
    const out: string[] = [];
    const sr = typeof raw.effectiveSavingsRate === "number" ? raw.effectiveSavingsRate : 0;
    const steps = typeof raw.completedSteps === "number" ? raw.completedSteps : 0;
    const onTrack = typeof raw.goalsOnTrack === "number" ? raw.goalsOnTrack : 0;
    const wgr = typeof raw.wealthGrowthRate === "number" ? raw.wealthGrowthRate : 0;
    if (sr > 0) out.push(`Your effective savings rate is ${sr.toFixed(0)}% — ${sr >= 20 ? "excellent, you're in the top tier!" : sr >= 10 ? "consider pushing to 20% for maximum score" : "try reaching 10% as the first milestone"}`);
    out.push(`You've completed ${steps} of 6 plan steps — ${steps >= 5 ? "almost there!" : steps >= 3 ? "keep going, each step boosts your score" : "complete more steps to improve your score"}`);
    out.push(`${onTrack} goal${onTrack !== 1 ? "s" : ""} on track — ${onTrack > 0 ? "great progress! Stay consistent." : "set a goal with a target date to unlock 25 more points"}`);
    if (wgr > 0) out.push(`Wealth growing at ${wgr.toFixed(1)}%/year — ${wgr >= 10 ? "excellent growth rate!" : wgr >= 5 ? "solid, keep investing" : "consider increasing your investment allocation"}`);
    return out;
  })();

  const chartData = history.length > 1
    ? history.map(h => ({ score: h.overallScore, date: h.scoreDate }))
    : null;

  if (isLoading || (!score && calculate.isPending)) return (
    <AppShell>
      <div className="space-y-4 pb-20">
        <div className="h-52 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}</div>
        <div className="h-32 bg-muted animate-pulse rounded-2xl" />
      </div>
      <BottomNav />
    </AppShell>
  );

  return (
    <AppShell>
      <div className="pb-20 md:pb-0 space-y-5">
        {/* Hero card — white with custom SVG arc ring */}
        {(() => {
          const r = 84;
          const circ = 2 * Math.PI * r;
          const offset = circ * (1 - overall / 100);
          const arcColor = overall >= 70 ? "#1D9E75" : overall >= 50 ? "#E8A53C" : overall > 0 ? "#D86B5A" : "#E6F5EE";
          const statusText = overall >= 85 ? "Excellent" : overall >= 70 ? "Good shape" : overall >= 50 ? "Getting there" : overall > 0 ? "Needs attention" : "Calculating...";
          const statusColor = overall >= 70 ? "#1D9E75" : overall >= 50 ? "#E8A53C" : overall > 0 ? "#D86B5A" : "#A8A095";
          return (
            <motion.div
              className="bg-white rounded-[20px] p-6 text-center"
              style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-center mb-2">
                <svg width={200} height={200} viewBox="0 0 200 200">
                  <circle cx={100} cy={100} r={r} fill="none" stroke="#E6F5EE" strokeWidth={14} />
                  <circle cx={100} cy={100} r={54} fill="#FAF8F5" />
                  <circle
                    cx={100} cy={100} r={r} fill="none"
                    stroke={arcColor} strokeWidth={14} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    transform="rotate(-90 100 100)"
                    style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
                  />
                  <text x={100} y={96} textAnchor="middle" dominantBaseline="middle"
                    fontFamily="'Sora', sans-serif" fontSize={46} fontWeight={800}
                    fill="#042C53" letterSpacing={-2}>
                    {overall > 0 ? overall : "—"}
                  </text>
                  <text x={100} y={116} textAnchor="middle"
                    fontFamily="'JetBrains Mono', monospace" fontSize={9}
                    fill="#A8A095" letterSpacing={2.5}>
                    OUT OF 100
                  </text>
                  <text x={100} y={132} textAnchor="middle"
                    fontFamily="'Plus Jakarta Sans', sans-serif" fontSize={13}
                    fontWeight={600} fill={statusColor}>
                    {statusText}
                  </text>
                </svg>
              </div>
              <button
                className="inline-flex items-center gap-1.5 rounded-full transition-colors"
                style={{ border: "1.5px solid #E6E1D8", padding: "7px 16px", fontSize: 13, fontWeight: 500, color: "#6B6459", background: "white" }}
                onClick={() => calculate.mutate()} disabled={calculate.isPending}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", calculate.isPending && "animate-spin")} />
                {calculate.isPending ? "Calculating…" : "Recalculate"}
              </button>
              <p style={{ fontSize: 11, color: "#A8A095", marginTop: 8 }}>Updates when you edit your plan, budget, or asset data</p>
            </motion.div>
          );
        })()}

        {/* Dimension breakdown */}
        {score && (
          <div className="bg-white rounded-[20px]" style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)", padding: 18 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#A8A095", marginBottom: 14 }}>
              WHAT MAKES YOUR SCORE
            </p>
            <div className="space-y-3">
              {breakdown.map((b) => {
                const pct = b.score / b.maxScore;
                const barColor = pct >= 0.8 ? "#1D9E75" : pct >= 0.5 ? "#E8A53C" : "#D86B5A";
                const scoreColor = pct >= 0.8 ? "#1D9E75" : pct >= 0.5 ? "#E8A53C" : "#D86B5A";
                return (
                  <Link href={b.editHref} key={b.label}>
                    <div className="cursor-pointer">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 14 }}>{b.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#2D2A24" }}>{b.label}</span>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: scoreColor }}>
                          {Math.min(b.score, b.maxScore)}/{b.maxScore}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "#F2EFE9", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 999, background: barColor, width: `${Math.min(100, pct * 100)}%`, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* How to improve each area */}
        {score && overall < 80 && (
          <div className="bg-card border border-card-border rounded-2xl p-4">
            <p className="text-sm font-semibold mb-3">How to boost your score</p>
            <div className="space-y-2.5">
              {breakdown.filter(b => b.score < b.maxScore).slice(0, 3).map(b => (
                <Link key={b.label} href={b.editHref}>
                  <div className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer group">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{b.icon}</span>
                      <div>
                        <p className="text-xs font-medium">{b.editLabel}</p>
                        <p className="text-[11px] text-muted-foreground">{b.label} · {b.maxScore - b.score} pts available</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
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

        {/* Peer benchmark comparison */}
        {score && (effectiveSavingsRate > 0 || overall > 0) && (
          <BenchmarkCard
            userSavingsRate={effectiveSavingsRate}
            userHealthScore={overall}
            age={null}
          />
        )}

        {/* Score history */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3">Score history</p>
          {chartData ? (
            <div className="bg-card border border-card-border rounded-2xl p-4">
              <div role="img" aria-label={`Health score history: latest score ${chartData[chartData.length - 1]?.score ?? "unavailable"} out of 100`}>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={chartData}>
                    <Tooltip formatter={(v) => [`${v}`, "Score"]} labelFormatter={(l) => new Date(l).toLocaleDateString("en-US", { month: "short" })} />
                    <Line type="monotone" dataKey="score" stroke="#1D9E75" strokeWidth={2} dot={{ fill: "#1D9E75", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-2xl p-5 text-center">
              <p className="text-muted-foreground text-sm">Check back next month to see your trend</p>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
