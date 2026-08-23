import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import ClientAppShell from "@/components/client/AppShell";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import HealthScoreRing from "@/components/shared/HealthScoreRing";

interface HealthScore {
  id: string;
  overallScore: number | null;
  budgetScore: number | null;
  goalsScore: number | null;
  netWorthScore: number | null;
  savingsScore: number | null;
}

export default function ClientHealthScore() {
  const { user, isLoaded } = useUser();
  const enabled = isLoaded && !!user;

  const { data: health, isLoading } = useQuery<HealthScore | null>({
    queryKey: ["client-health"],
    queryFn: () => apiFetch<HealthScore>("/client/health-score").catch(() => null),
    enabled,
  });

  const score = health?.overallScore ?? 0;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const factors = [
    { label: "Contribution consistency", score: health?.savingsScore ?? 0, color: "var(--green)" },
    { label: "Goal funding", score: health?.goalsScore ?? 0, color: "var(--green)" },
    { label: "Diversification", score: health?.netWorthScore ?? 0, color: "var(--sun)" },
    { label: "Cash resilience", score: health?.budgetScore ?? 0, color: "var(--clay)" },
  ];
  const lowestFactor = factors.reduce((lowest, factor) => factor.score < lowest.score ? factor : lowest, factors[0]);

  return (
    <ClientAppShell>
      <div className="space-y-[14px]">
        <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em] mb-[14px]">
          Financial health
        </h1>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-48 bg-surface rounded-[32px]" />
            <div className="h-64 bg-surface rounded-[26px]" />
          </div>
        ) : !health || health.overallScore == null ? (
          <div className="rounded-[28px] bg-surface p-8 text-center shadow-[0_2px_14px_rgba(20,52,42,.06)]">
            <h2 className="font-display text-[22px] font-semibold text-forest">Your health score is not ready yet</h2>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-40">
              Add your current budget, goals, and portfolio details so tala can calculate a useful score.
            </p>
            <Link href="/client/budget" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper">
              Update financial details
            </Link>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-surface rounded-[32px] p-[24px_22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] mb-[16px] text-center relative">
              <div className="flex justify-center mb-2">
                <HealthScoreRing score={score} size="lg" />
              </div>
              <div className="text-[15px] font-semibold text-green mb-1">
                {score >= 70 ? "Strong" : score >= 50 ? "Solid" : "Needs attention"}
              </div>
              <div className="text-[14px] text-ink-40 leading-[1.5] text-pretty">
                Your score reflects the financial information currently tracked in tala.
              </div>
            </div>

            <div className="bg-surface rounded-[26px] p-[8px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
              {factors.map((f, i) => (
                <div key={i} className={cn("py-[14px]", i < factors.length - 1 && "border-b border-hairline")}>
                  <div className="flex justify-between items-center mb-[8px]">
                    <span className="text-[15px] font-semibold text-forest">{f.label}</span>
                    <span className="text-[14px] font-semibold" style={{ color: f.color }}>
                      {f.score >= 80 ? "Excellent" : f.score >= 60 ? "Good" : "Watch"} · {f.score}%
                    </span>
                  </div>
                  <div className="h-[6px] rounded-full bg-track overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${f.score}%`, backgroundColor: f.color }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-[14px] bg-forest rounded-[22px] p-[16px_18px] text-[14px] text-green-tint leading-[1.5] text-pretty">
              Improving <strong className="text-sun font-semibold">{lowestFactor.label.toLowerCase()}</strong> is your clearest next step.
              <div className="mt-3">
                <Link href="/client/portfolio" className="inline-flex py-2 px-4 rounded-[14px] bg-green text-white font-sans text-sm font-semibold cursor-pointer hover:bg-forest-700 transition-colors">
                  Set up the buffer
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientAppShell>
  );
}