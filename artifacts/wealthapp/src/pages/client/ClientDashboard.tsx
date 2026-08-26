import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Hourglass, TrendingUp, Target, MessageSquare, Sparkles, X } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import ClientAppShell from "@/components/client/AppShell";
import Sol from "@/components/Sol";
import CurrencyField from "@/components/shared/CurrencyField";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useProfile } from "@/hooks/useProfile";
import { usePlan } from "@/hooks/usePlan";
import { useNetWorthTrend } from "@/hooks/useNetWorthTrend";
import WealthScoreCard from "@/components/client/dashboard/WealthScoreCard";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

export default function ClientDashboard() {
  const data = useDashboardData();
  const { profile, update } = useProfile();
  const { plan, nextMilestone, milestones } = usePlan();
  const { trendData, hasHistory } = useNetWorthTrend();
  const [showScenarioAlert, setShowScenarioAlert] = useState(true);

  if (data.isLoading) {
    return (
      <ClientAppShell>
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-paper rounded-[26px]" />
          <div className="h-48 bg-surface rounded-[26px]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-32 bg-forest rounded-[26px]" />
            <div className="h-32 bg-sun-tint rounded-[26px]" />
          </div>
        </div>
      </ClientAppShell>
    );
  }

  const firstName = profile?.fullName?.split(" ")[0] ?? "Client";
  const advisorInitials = data.advisorName 
    ? data.advisorName.split(" ").map(n => n[0]).join("") 
    : "TL";

  const currency = profile?.preferredCurrency ?? "USD";
  const toggleCurrency = () => {
    update.mutate({ preferredCurrency: currency === "USD" ? "VND" : "USD" });
  };

  // Pending Setup State (Sunrise styled)
  if (data.hasPendingAdvisorSetup) {
    return (
      <ClientAppShell>
        <div className="space-y-[14px]">
          <div className="flex items-start justify-between gap-[14px] mb-[22px]">
            <div className="flex items-start gap-[14px]">
              <Sol size="md" animate="breathe" />
              <div className="pt-1.5">
                <div className="tala-eyebrow text-amber-ink mb-1 text-[#C98A2E]">Sol</div>
                <div className="font-display text-[23px] font-medium leading-[1.25] text-forest tracking-[-0.01em] text-pretty">
                  {getGreeting()}, {firstName}. Your portfolio is being prepared.
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-surface rounded-[26px] p-[28px_24px] shadow-[0_2px_14px_rgba(20,52,42,.06)] text-center">
            <div className="w-[48px] h-[48px] rounded-full bg-forest flex items-center justify-center text-paper mx-auto mb-4">
              <Hourglass className="h-6 w-6" />
            </div>
            <h2 className="font-display text-[22px] font-semibold text-forest mb-2">Portfolio in preparation</h2>
            <p className="text-[14px] text-ink-60 mb-6 text-pretty max-w-[320px] mx-auto">
              {data.advisorName ? `${data.advisorName} is setting up your investment plan.` : "Your advisor is setting up your investment plan."} This usually takes less than 24 hours.
            </p>
            
            <div className="space-y-3 max-w-[320px] mx-auto">
              <Link href="/client/portfolio">
                <div className="bg-paper border border-[#E6E1D8] rounded-[18px] p-[16px] flex items-center gap-3 cursor-pointer hover:border-[#1D9E75] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#F3F0EA] flex items-center justify-center text-forest"><TrendingUp className="h-4 w-4" /></div>
                  <span className="text-[14px] font-semibold text-forest">Add other investments</span>
                </div>
              </Link>
              <Link href="/client/goals">
                <div className="bg-paper border border-[#E6E1D8] rounded-[18px] p-[16px] flex items-center gap-3 cursor-pointer hover:border-[#1D9E75] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#F3F0EA] flex items-center justify-center text-forest"><Target className="h-4 w-4" /></div>
                  <span className="text-[14px] font-semibold text-forest">Set a financial goal</span>
                </div>
              </Link>
              <Link href="/client/messages">
                <div className="bg-paper border border-[#E6E1D8] rounded-[18px] p-[16px] flex items-center gap-3 cursor-pointer hover:border-[#1D9E75] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#F3F0EA] flex items-center justify-center text-forest"><MessageSquare className="h-4 w-4" /></div>
                  <span className="text-[14px] font-semibold text-forest">Message your advisor</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </ClientAppShell>
    );
  }

  return (
    <ClientAppShell>
      <div className="space-y-[14px]">
        {/* Header & Currency Toggle */}
        <div className="flex items-start justify-between gap-[14px] mb-[22px]">
          <div className="flex items-start gap-[14px]">
            <Sol size="md" animate="breathe" />
            <div className="pt-1.5">
              <div className="tala-eyebrow text-amber-ink mb-1 text-[#C98A2E]">Sol</div>
              <div className="font-display text-[23px] font-medium leading-[1.25] text-forest tracking-[-0.01em] text-pretty">
                {getGreeting()}, {firstName}.
              </div>
            </div>
          </div>
          <button
            onClick={toggleCurrency}
            className="shrink-0 min-h-[36px] px-3.5 mt-1 rounded-full border border-[#E6E1D8] bg-surface font-mono text-[11px] font-medium text-forest cursor-pointer hover:border-green hover:text-green transition-colors"
          >
            {currency}
          </button>
        </div>

        {/* Scenario Alert (Track A) */}
        {data.isTrackA && data.scenarioAlert && showScenarioAlert && (
          <div className="relative bg-forest rounded-[22px] p-[16px_52px_16px_18px] flex items-center gap-3 overflow-hidden animate-rise-up mb-4">
            <div className="w-[34px] h-[34px] rounded-full bg-sun flex-none flex items-center justify-center text-[16px] text-sun-ink">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-paper">{data.scenarioAlert.scenarioName ?? "Scenario Updated"}</div>
              <div className="text-[13px] text-mint">
                Delta: {Number(data.scenarioAlert.deltaPct) > 0 ? "+" : ""}{data.scenarioAlert.deltaPct}% to your final projection.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScenarioAlert(false)}
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-mint transition-colors hover:bg-white/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
              aria-label="Dismiss scenario update"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Net worth card */}
        <Link
          href="/client/portfolio"
          className="bg-surface rounded-[26px] p-[22px_24px_18px] shadow-[0_2px_14px_rgba(20,52,42,.06)] block transition-colors hover:ring-1 hover:ring-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
          aria-label="View portfolio and net worth details"
        >
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[14px] font-semibold text-ink-40">Net worth</span>
            {data.portfolio.gainLossPct !== 0 && (
              <span className={`text-[13px] font-semibold px-[9px] py-[4px] rounded-full ${data.portfolio.gainLossPct >= 0 ? "text-green bg-green-tint" : "text-[#D34B4B] bg-[#FCE8E8]"}`}>
                {data.portfolio.gainLossPct >= 0 ? "+" : ""}{data.portfolio.gainLossPct.toFixed(1)}% YTD
              </span>
            )}
          </div>
          
          <div className="font-display text-[44px] font-semibold tracking-[-0.03em] text-forest my-1.5 tabular-nums leading-none">
            <CurrencyField amountUsd={data.netWorth?.netWorth ?? 0} />
          </div>
          <div className="text-[14px] text-ink-40 mb-[14px]">
            <CurrencyField amountUsd={data.portfolio.totalValue} compact /> {data.isTrackA ? "advised & self-managed" : "self-managed"}
          </div>
          
          <div className="h-[70px] w-full" role="img" aria-label={hasHistory ? "Net worth trend over time" : "Net worth trend will appear after more updates"}>
            {hasHistory ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="clientNetWorthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--green)" stopOpacity={0.28} />
                      <stop offset="1" stopColor="var(--green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    stroke="var(--green)"
                    strokeWidth={2.5}
                    fill="url(#clientNetWorthFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--green)" }}
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center text-[13px] text-ink-30">
                Your trend will appear as you update your values over time.
              </div>
            )}
          </div>
        </Link>

        {/* Wealth Score */}
        <WealthScoreCard />

        {/* Track B Conversion CTA */}
        {data.isTrackB && (
          <div className="bg-sun-tint rounded-[26px] p-[22px_24px_22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
            <div className="font-display text-[22px] font-semibold text-amber-ink tracking-[-0.01em] mb-2">Upgrade to Advised</div>
            <div className="text-[14.5px] text-[#A67523] mb-4 text-pretty leading-snug">
              Unlock personalized strategies, goal projections, and a dedicated advisor to accelerate your wealth.
            </div>
            <Link href="/client/messages" className="bg-amber-ink text-paper rounded-full py-2.5 px-5 text-[14px] font-semibold inline-block hover:opacity-90 transition-opacity">
              Talk to an advisor
            </Link>
          </div>
        )}

        {/* Goals / Milestones row */}
        {(data.topGoals.length > 0 || nextMilestone) && (
          <div className="grid grid-cols-2 gap-3">
            {data.topGoals.length > 0 ? (
              <Link href="/client/goals">
                <div className="bg-forest rounded-[22px] p-[18px] cursor-pointer h-full flex flex-col justify-between">
                  <div>
                    <div className="text-[13px] text-mint font-semibold mb-1">Top Goal</div>
                    <div className="font-display text-[20px] font-semibold text-paper tracking-[-0.01em] leading-tight mb-2">
                      {data.topGoals[0].title}
                    </div>
                  </div>
                  {data.topGoals[0].targetAmount && (
                    <div>
                      <div className="text-[13px] text-mint mb-2">
                        <CurrencyField amountUsd={Number(data.topGoals[0].currentAmount)} compact /> / <CurrencyField amountUsd={Number(data.topGoals[0].targetAmount)} compact />
                      </div>
                      <div className="h-[4px] w-full bg-mint/20 rounded-full overflow-hidden">
                        <div className="h-full bg-sun rounded-full" style={{ width: `${Math.min(100, (Number(data.topGoals[0].currentAmount) / Number(data.topGoals[0].targetAmount)) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ) : (
              <Link href="/client/goals">
                <div className="bg-forest rounded-[22px] p-[18px] cursor-pointer h-full flex flex-col justify-center items-center text-center">
                  <Target className="h-6 w-6 text-mint mb-2" />
                  <div className="text-[14px] font-semibold text-paper">Set a goal</div>
                </div>
              </Link>
            )}
            
            <Link href="/client/plan">
              <div className="bg-sun-tint rounded-[22px] p-[18px] cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="text-[13px] text-[#B07A22] font-semibold mb-1">Next milestone</div>
                  <div className="font-display text-[19px] font-semibold text-amber-ink tracking-[-0.01em] leading-tight mb-2 truncate">
                    {nextMilestone?.title ?? "Create a plan"}
                  </div>
                </div>
                {nextMilestone && (
                  <div className="text-[12.5px] text-[#B07A22] font-medium">
                    {nextMilestone.targetDate ? new Date(nextMilestone.targetDate).getFullYear() : "Future"}
                    {milestones.length > 0 && ` · ${Math.round((milestones.filter(m => m.status === "completed").length / milestones.length) * 100)}% there`}
                  </div>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* Adviser card (Track A) */}
        {data.isTrackA && data.advisorName && (
          <Link href="/client/messages">
            <div className="bg-surface rounded-[26px] p-[18px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)] cursor-pointer">
              <div className="flex justify-between items-center mb-3">
                <span className="font-display text-[17px] font-semibold text-forest">Connect with {data.advisorName.split(" ")[0]}</span>
                <span className="text-[13px] font-semibold text-green">Message</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-[38px] h-[38px] rounded-full bg-[#DCEAE3] flex-none flex items-center justify-center text-[14px] font-semibold text-forest">
                  {advisorInitials}
                </div>
                <div className="text-[14px] text-ink-60 leading-[1.4] text-pretty">
                  Need an adjustment to your plan? Send a message directly.
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </ClientAppShell>
  );
}
