import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import ClientAppShell from "@/components/client/AppShell";
import { useUser } from "@clerk/react";

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

  const score = health?.overallScore ?? 72;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const factors = [
    { label: "Contribution consistency", score: health?.savingsScore ?? 88, color: "#1D9E75" },
    { label: "Goal funding", score: health?.goalsScore ?? 71, color: "#1D9E75" },
    { label: "Diversification", score: health?.netWorthScore ?? 64, color: "#F5B947" },
    { label: "Cash resilience", score: health?.budgetScore ?? 42, color: "#D86B5A" },
  ];

  return (
    <ClientAppShell>
      <div className="max-w-[900px] mx-auto pb-6">
        <h1 className="font-display text-[22px] font-bold text-[#042C53] tracking-[-0.02em] mb-4.5">
          Financial health
        </h1>

        {isLoading ? (
          <div className="h-48 bg-[#E6E1D8]/30 rounded-[24px] animate-pulse" />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white border border-[#E6E1D8] rounded-[24px] p-5 sm:p-6 flex items-center gap-5 shadow-[0_4px_14px_rgba(4,44,83,.06)]">
              <div className="relative w-[116px] h-[116px] shrink-0">
                <svg width="116" height="116" viewBox="0 0 116 116" className="-rotate-90">
                  <circle cx="58" cy="58" r="48" fill="none" stroke="#F2EFE9" strokeWidth="12" />
                  <circle cx="58" cy="58" r="48" fill="none" stroke="#1D9E75" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-display text-[32px] font-bold text-[#042C53] tracking-[-0.03em] leading-none">
                    {Math.round(score)}
                  </div>
                  <div className="text-[10px] text-[#6B6459] mt-0.5">out of 100</div>
                </div>
              </div>
              <div>
                <div className="inline-block text-[11px] font-semibold text-[#0F6E56] bg-[#E6F5EE] px-2.5 py-1.25 rounded-full">
                  Solid
                </div>
                <div className="text-[13px] leading-[1.5] text-[#2D2A24] mt-2.5 text-pretty">
                  Up 4 points since May, mostly from steady contributions.
                </div>
              </div>
            </div>

            <div className="mt-3.5 bg-[#042C53] rounded-[24px] p-5 text-white">
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#7FCBAE] mb-2.5">
                Raise it by 8 points
              </div>
              <div className="font-display text-base font-semibold leading-[1.35] mb-2">
                Build your cash buffer to three months of expenses
              </div>
              <div className="text-xs text-[#A9C0D6] leading-[1.5]">
                You hold $6,200 in cash against monthly expenses of $4,300. Adding $6,700 would cover three months and lift resilience from 42 to 74.
              </div>
              <Link href="/client/portfolio">
                <button className="mt-4 min-h-[44px] w-full border-none rounded-[14px] bg-[#1D9E75] text-white font-sans text-sm font-semibold cursor-pointer hover:bg-[#17805F] transition-colors">
                  Set up the buffer
                </button>
              </Link>
            </div>

            <div className="mt-3.5 bg-white border border-[#E6E1D8] rounded-[20px] p-4.5">
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B6459] mb-3.5">
                What makes up the score
              </div>
              {factors.map((f, i) => (
                <div key={i} className="mb-3.5 last:mb-0">
                  <div className="flex justify-between items-center text-xs text-[#2D2A24] mb-1.5">
                    <span>{f.label}</span>
                    <span className="font-mono text-[#6B6459]">{f.score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F2EFE9] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${f.score}%`, backgroundColor: f.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ClientAppShell>
  );
}