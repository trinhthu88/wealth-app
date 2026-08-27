import { useState } from "react";
import { Link } from "wouter";
import { Hourglass, TrendingUp, Target, MessageSquare, Sparkles, X } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import Sol from "@/components/Sol";
import SolNarration from "@/components/client/SolNarration";
import CurrencyField from "@/components/shared/CurrencyField";
import WealthScoreCard from "@/components/client/dashboard/WealthScoreCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useProfile } from "@/hooks/useProfile";
import { usePlan } from "@/hooks/usePlan";
import { useNetWorthSummary } from "@/hooks/useNetWorthSummary";
import { useNetWorthTrend } from "@/hooks/useNetWorthTrend";
import { cn } from "@/lib/utils";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 18) return "Afternoon";
  return "Evening";
}

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }
function fmtUsd(v: number) { return `$${Math.round(Math.abs(v)).toLocaleString()}`; }
function daysSince(dateStr: string) { return (Date.now() - new Date(dateStr).getTime()) / 86_400_000; }

export default function ClientDashboard() {
  const data = useDashboardData();
  const { profile } = useProfile();
  const { nextMilestone, advisorName } = usePlan();
  const netWorthSummary = useNetWorthSummary();
  const { trendData, hasHistory } = useNetWorthTrend();
  const [showScenarioAlert, setShowScenarioAlert] = useState(true);

  const topPlan = data.plans.find(p => p.status === "inforce" && p.isVisibleToClient) ?? null;
  const recentStatementPlan = data.plans.find(
    p => p.latestStatementDate && daysSince(p.latestStatementDate) <= 14
  ) ?? null;
  const [dismissedCelebration, setDismissedCelebration] = useState(() =>
    recentStatementPlan ? localStorage.getItem(`celebration_dismissed_${recentStatementPlan.latestStatementDate}`) === "1" : true
  );

  if (data.isLoading) {
    return (
      <ClientAppShell>
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-surface rounded-2xl" />
          <div className="h-40 bg-surface rounded-[26px]" />
          <div className="h-28 bg-forest/10 rounded-[26px]" />
        </div>
      </ClientAppShell>
    );
  }

  const firstName = profile?.fullName?.split(" ")[0] ?? "there";
  const advisorFirstName = advisorName?.split(" ")[0] ?? data.advisorName?.split(" ")[0] ?? null;

  // Pending Setup State (unchanged — the app isn't ready to show a portfolio yet)
  if (data.hasPendingAdvisorSetup) {
    return (
      <ClientAppShell>
        <div className="space-y-[14px]">
          <div className="flex items-start gap-[14px] mb-[22px]">
            <Sol size="md" animate="breathe" />
            <div className="pt-1.5">
              <div className="text-[11.5px] font-bold tracking-[0.09em] uppercase text-[#C98A2E]">Sol</div>
              <div className="font-display text-[23px] font-medium leading-[1.25] text-forest tracking-[-0.01em] text-pretty">
                {getGreeting()}, {firstName}. Your portfolio is being prepared.
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
                <div className="bg-paper border border-[#E6E1D8] rounded-[18px] p-[16px] flex items-center gap-3 cursor-pointer hover:border-green transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#F3F0EA] flex items-center justify-center text-forest"><TrendingUp className="h-4 w-4" /></div>
                  <span className="text-[14px] font-semibold text-forest">Add other investments</span>
                </div>
              </Link>
              <Link href="/client/goals">
                <div className="bg-paper border border-[#E6E1D8] rounded-[18px] p-[16px] flex items-center gap-3 cursor-pointer hover:border-green transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#F3F0EA] flex items-center justify-center text-forest"><Target className="h-4 w-4" /></div>
                  <span className="text-[14px] font-semibold text-forest">Set a financial goal</span>
                </div>
              </Link>
              <Link href="/client/messages">
                <div className="bg-paper border border-[#E6E1D8] rounded-[18px] p-[16px] flex items-center gap-3 cursor-pointer hover:border-green transition-colors">
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

  const topGoal = data.topGoals[0] ?? null;
  const goalPct = topGoal?.targetAmount ? Math.min(100, Math.round((n(topGoal.currentAmount) / n(topGoal.targetAmount)) * 100)) : null;

  const netContributed = n(topPlan?.latestNetContribution);
  const planGain = topPlan ? n(topPlan.latestAccountValue) - netContributed : 0;

  const solLine = topGoal && goalPct != null
    ? `${getGreeting()}, ${firstName}. You're ${goalPct}% of the way to ${topGoal.title}.`
    : topPlan
    ? `${getGreeting()}, ${firstName}. Your plan is up ${fmtUsd(planGain)} since you started.`
    : `${getGreeting()}, ${firstName}. Here's where things stand today.`;

  const solDetail = topGoal && goalPct != null
    ? `You've put in ${fmtUsd(n(topGoal.currentAmount))} toward a ${fmtUsd(n(topGoal.targetAmount))} target. Early progress on a long-dated goal is mostly what you pay in — compounding does more of the work later on.`
    : topPlan
    ? `You've paid in ${fmtUsd(netContributed)} and the account sits at ${fmtUsd(n(topPlan.latestAccountValue))}. Contributions do most of the heavy lifting early in a plan; compounding takes over later. That's the normal shape of a regular savings plan.`
    : undefined;

  return (
    <ClientAppShell>
      <div className="space-y-[12px] pb-8">
        <SolNarration line={solLine} detail={solDetail} advisorFirstName={advisorFirstName} />

        {recentStatementPlan && !dismissedCelebration && (
          <div className="relative bg-forest rounded-[22px] p-[16px_44px_16px_18px] flex items-center gap-3 overflow-hidden mb-1">
            <span className="absolute top-[10px] right-[44px] text-[#FFB627] text-[13px] animate-sparkle">✦</span>
            <span className="absolute bottom-[14px] right-[88px] text-[#FFB627] text-[9px] animate-sparkle [animation-delay:0.8s]" />
            <div className="w-[34px] h-[34px] rounded-full bg-sun flex-none flex items-center justify-center text-[16px] text-sun-ink">✓</div>
            <div>
              <div className="text-[15px] font-semibold text-paper">Statement posted</div>
              <div className="text-[13px] text-mint">{recentStatementPlan.nickname ?? recentStatementPlan.productName} was just updated.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(`celebration_dismissed_${recentStatementPlan.latestStatementDate}`, "1");
                setDismissedCelebration(true);
              }}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-mint hover:bg-white/10 hover:text-paper transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {data.isTrackA && data.scenarioAlert && showScenarioAlert && (
          <div className="relative bg-forest rounded-[22px] p-[16px_52px_16px_18px] flex items-center gap-3 overflow-hidden mb-1">
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
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-mint hover:bg-white/10 hover:text-paper transition-colors"
              aria-label="Dismiss scenario update"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Net worth card */}
        <Link
          href="/client/networth"
          className="bg-surface rounded-[26px] p-[22px_24px_16px] shadow-[0_2px_14px_rgba(20,52,42,.06)] block transition-colors hover:ring-1 hover:ring-green"
        >
          <div className="flex justify-between items-baseline">
            <span className="text-[13.5px] font-semibold text-ink-40">Net worth</span>
          </div>
          <div className="font-display text-[44px] font-semibold tracking-[-0.03em] text-forest my-1 tabular-nums leading-none">
            <CurrencyField amountUsd={netWorthSummary.netWorth} compact={Math.abs(netWorthSummary.netWorth) > 1_000_000} />
          </div>
          <div className="text-[13.5px] text-ink-40 mb-3">
            <CurrencyField amountUsd={data.portfolio.totalValue} compact /> invested · <CurrencyField amountUsd={netWorthSummary.totalAssets - data.portfolio.totalValue} compact /> other
          </div>
          <div className="h-[66px] w-full" role="img" aria-label={hasHistory ? "Net worth trend over time" : "Net worth trend will appear after more updates"}>
            {hasHistory ? (
              <svg viewBox="0 0 300 66" className="w-full h-full">
                <defs>
                  <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--green)" stopOpacity="0.26" />
                    <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const w = 300, h = 66;
                  const vals = trendData.map(d => d.netWorth);
                  const min = Math.min(...vals), max = Math.max(...vals);
                  const range = max - min || 1;
                  const pts = vals.map((v, i) => [
                    (i / (vals.length - 1 || 1)) * w,
                    h - 6 - ((v - min) / range) * (h - 12),
                  ]);
                  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
                  const area = `${line} L${w} ${h} L0 ${h} Z`;
                  const last = pts[pts.length - 1];
                  return (
                    <>
                      <path d={area} fill="url(#nwFill)" />
                      <path d={line} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--green)" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="flex h-full items-center text-[13px] text-ink-30">
                Your trend will appear as you update your values over time.
              </div>
            )}
          </div>
        </Link>

        {/* Advised plan card */}
        {topPlan && (
          <Link
            href={`/client/portfolio/${topPlan.id}`}
            className="block bg-forest rounded-[26px] p-[20px_22px] cursor-pointer"
          >
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[13px] font-semibold text-mint">{topPlan.nickname ?? topPlan.productName} · {topPlan.providerName}</span>
              <span className="text-[12.5px] font-semibold text-forest bg-sun px-[9px] py-[3px] rounded-full">In force</span>
            </div>
            <div className="font-display text-[34px] font-semibold text-paper tracking-[-0.025em] tabular-nums">
              <CurrencyField amountUsd={n(topPlan.latestAccountValue)} currency={topPlan.currency} compact />
            </div>
            <div className="text-[13.5px] text-mint mt-0.5">
              <CurrencyField amountUsd={netContributed} currency={topPlan.currency} compact /> paid in · <CurrencyField amountUsd={planGain} currency={topPlan.currency} compact showSign /> growth
            </div>
          </Link>
        )}

        {/* Wealth Score */}
        <WealthScoreCard />

        {/* Two-up: top goal + next milestone */}
        {(topGoal || nextMilestone) && (
          <div className="grid grid-cols-2 gap-3">
            {topGoal ? (
              <Link href="/client/goals" className="bg-surface rounded-[22px] p-[18px] shadow-[0_2px_14px_rgba(20,52,42,.06)] cursor-pointer block">
                <div className="text-[12.5px] font-semibold text-ink-40 truncate">{topGoal.title}</div>
                {goalPct != null ? (
                  <>
                    <div className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em]">
                      {goalPct}<span className="text-[15px] text-ink-20">%</span>
                    </div>
                    <div className="h-[7px] rounded-full bg-hairline-2 overflow-hidden mt-1.5">
                      <div className="h-full rounded-full bg-green" style={{ width: `${goalPct}%` }} />
                    </div>
                  </>
                ) : (
                  <div className="text-[13.5px] text-ink-40 mt-1">In progress</div>
                )}
              </Link>
            ) : (
              <Link href="/client/goals" className="bg-surface rounded-[22px] p-[18px] shadow-[0_2px_14px_rgba(20,52,42,.06)] cursor-pointer flex flex-col items-center justify-center text-center">
                <Target className="h-6 w-6 text-green mb-2" />
                <div className="text-[14px] font-semibold text-forest">Set a goal</div>
              </Link>
            )}

            <Link href="/client/plan" className="bg-sun-tint rounded-[22px] p-[18px] cursor-pointer block">
              <div className="text-[12.5px] font-semibold text-[#B07A22]">Next milestone</div>
              <div className="font-display text-[18px] font-semibold text-amber-ink tracking-[-0.01em] leading-[1.2] my-0.5 truncate">
                {nextMilestone?.title ?? "Create a plan"}
              </div>
              <div className="text-[12.5px] text-[#B07A22]">
                {nextMilestone?.targetDate ? new Date(nextMilestone.targetDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </div>
            </Link>
          </div>
        )}

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

        {/* Advisor card */}
        {data.isTrackA && data.advisorName && (
          <Link href="/client/messages">
            <div className="bg-surface rounded-[26px] p-[18px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)] cursor-pointer">
              <div className="flex justify-between items-center mb-3">
                <span className="font-display text-[16.5px] font-semibold text-forest">Your advisor</span>
                <span className="text-[12.5px] font-semibold text-green">Message</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-[38px] h-[38px] rounded-full bg-[#DCEAE3] flex-none flex items-center justify-center text-[14px] font-semibold text-forest">
                  {data.advisorName.split(" ").map(p => p[0]).join("")}
                </div>
                <div className={cn("text-[13.5px] text-ink-60 leading-[1.45] text-pretty")}>
                  {advisorFirstName}: "Need an adjustment to your plan? Send a message directly."
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </ClientAppShell>
  );
}
