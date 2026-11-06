import { useState } from "react";
import { Link } from "wouter";
import { Hourglass, TrendingUp, Target, MessageSquare, Sparkles, X, Wallet, ArrowUpRight, ArrowDownRight, Check } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import Sol from "@/components/Sol";
import CurrencyField from "@/components/shared/CurrencyField";
import WealthScoreCard from "@/components/client/dashboard/WealthScoreCard";
import ClientSetupChecklistCard from "@/components/client/ClientSetupChecklistCard";
import AdvisorCard from "@/components/client/dashboard/AdvisorCard";
import MembershipCard from "@/components/client/dashboard/MembershipCard";
import EngagementStrip from "@/components/client/dashboard/EngagementStrip";
import ConversionCTASection from "@/components/client/dashboard/sections/ConversionCTASection";
import SmartUpgradeCard from "@/components/SmartUpgradeCard";
import ClientRiskCheckSheet from "@/components/client/ClientRiskCheckSheet";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useProfile } from "@/hooks/useProfile";
import { usePlan } from "@/hooks/usePlan";
import { useNetWorthSummary } from "@/hooks/useNetWorthSummary";
import { useNetWorthTrend } from "@/hooks/useNetWorthTrend";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { openSolChat } from "@/lib/solChat";

type WealthPeriod = "month" | "year" | "all";
const WEALTH_PERIOD_LABELS: Record<WealthPeriod, string> = { month: "this month", year: "past 12 months", all: "since you started tracking" };

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
  const [showRiskCheck, setShowRiskCheck] = useState(false);
  const [wealthPeriod, setWealthPeriod] = useState<WealthPeriod>("month");

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
        <div className="space-y-4">
          <ClientSetupChecklistCard onRiskCheck={() => setShowRiskCheck(true)} />
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-surface rounded-[24px]" />
            <div className="h-36 bg-surface rounded-[28px]" />
            <div className="h-28 bg-forest/10 rounded-[28px]" />
          </div>
        </div>
        <ClientRiskCheckSheet isOpen={showRiskCheck} onClose={() => setShowRiskCheck(false)} />
      </ClientAppShell>
    );
  }

  const firstName = profile?.fullName?.split(" ")[0] ?? "there";
  const advisorFirstName = advisorName?.split(" ")[0] ?? data.advisorName?.split(" ")[0] ?? null;

  // Pending Setup State (unchanged — the app isn't ready to show a portfolio yet)
  if (data.hasPendingAdvisorSetup) {
    const pendingLinks = [
      { href: "/client/wealth/investments", icon: TrendingUp, label: "Add other investments" },
      { href: "/client/goals/goals", icon: Target, label: "Set a financial goal" },
      { href: "/client/advisor/messages", icon: MessageSquare, label: "Message your advisor" },
    ];
    return (
      <ClientAppShell>
        <div className="space-y-4">
          <ClientSetupChecklistCard onRiskCheck={() => setShowRiskCheck(true)} />
          <div className="flex items-start gap-3 px-1">
            <Sol size="sm" animate="breathe" />
            <div className="pt-0.5 min-w-0">
              <div className="tala-eyebrow text-ink-40">Sol</div>
              <div className="text-[16px] font-medium leading-[1.4] text-forest mt-1 text-pretty">
                {getGreeting()}, {firstName}. Your portfolio is being prepared.
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-[28px] p-6 text-center">
            <div className="w-12 h-12 rounded-[14px] bg-field flex items-center justify-center text-forest mx-auto mb-4">
              <Hourglass className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="font-display text-[26px] leading-[1.1] text-forest mb-2">Portfolio in preparation</h2>
            <p className="text-[14px] text-ink-40 mb-6 text-pretty max-w-[320px] mx-auto">
              {data.advisorName ? `${data.advisorName} is setting up your investment plan.` : "Your advisor is setting up your investment plan."} This usually takes less than 24 hours.
            </p>
            <div className="bg-paper rounded-[24px] p-1 max-w-[340px] mx-auto text-left">
              {pendingLinks.map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href}>
                  <div className="p-3 flex items-center gap-3 cursor-pointer border-b border-hairline last:border-0 rounded-[20px] hover:bg-surface transition-colors">
                    <div className="w-10 h-10 rounded-[14px] bg-breeze flex-none flex items-center justify-center text-forest"><Icon className="h-4 w-4" aria-hidden="true" /></div>
                    <span className="text-[14px] font-semibold text-forest flex-1">{label}</span>
                    <div className="w-9 h-9 rounded-full bg-forest text-paper flex-none flex items-center justify-center">
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <ClientRiskCheckSheet isOpen={showRiskCheck} onClose={() => setShowRiskCheck(false)} />
      </ClientAppShell>
    );
  }

  const budgetMonthLabel = new Date().toLocaleDateString("en-US", { month: "long" });
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

  // ── Total wealth change for the Month / Year / All pills (from net worth snapshots) ──
  const latestPoint = trendData[trendData.length - 1] ?? null;
  const changeFor = (period: WealthPeriod): number | null => {
    if (!hasHistory || !latestPoint) return null;
    if (period === "all") return latestPoint.netWorth - trendData[0].netWorth;
    const cutoff = new Date(latestPoint.date);
    if (period === "month") cutoff.setMonth(cutoff.getMonth() - 1);
    else cutoff.setFullYear(cutoff.getFullYear() - 1);
    const base = [...trendData].reverse().find(p => new Date(p.date) <= cutoff) ?? trendData[0];
    return latestPoint.netWorth - base.netWorth;
  };
  const wealthChange = changeFor(wealthPeriod);
  const wealthChangeBase = wealthChange != null && latestPoint ? latestPoint.netWorth - wealthChange : 0;
  const wealthChangePct = wealthChange != null && wealthChangeBase !== 0 ? (wealthChange / Math.abs(wealthChangeBase)) * 100 : null;

  // ── Where the wealth sits ──
  // Same buckets as the Net Worth breakdown: a cash holding counts as cash, not as an investment.
  const { cashTotal, propertyTotal, investmentsTotal } = netWorthSummary;

  const GOAL_TINTS = ["bg-field", "bg-breeze", "bg-surface"];

  return (
    <ClientAppShell>
      <div className="space-y-4 pb-8">
        <ClientSetupChecklistCard onRiskCheck={() => setShowRiskCheck(true)} />
        <SmartUpgradeCard />

        {/* Total wealth — the one key number on Home */}
        <section aria-label="Total wealth" className="px-1 pt-1">
          <p className="text-[15px] font-medium text-ink-40">{getGreeting()}, {firstName} — your total wealth</p>
          <Link href="/client/wealth/overview" className="block mt-2.5 rounded-2xl">
            <span className="font-display tabular-nums text-[60px] leading-[0.95] tracking-[-0.045em] text-forest">
              <CurrencyField amountUsd={netWorthSummary.netWorth} compact={Math.abs(netWorthSummary.netWorth) > 1_000_000} />
            </span>
          </Link>
          {wealthChange != null ? (
            <>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-forest tabular-nums",
                  wealthChange >= 0 ? "bg-field" : "bg-sun",
                )}>
                  {wealthChange >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  <CurrencyField amountUsd={Math.abs(wealthChange)} compact />
                  {wealthChangePct != null && <> · {Math.abs(wealthChangePct).toFixed(1)}%</>}
                </span>
                <span className="text-[14px] text-ink-40">{WEALTH_PERIOD_LABELS[wealthPeriod]}</span>
              </div>
              <div role="group" aria-label="Time range" className="flex gap-1.5 mt-3">
                {(["month", "year", "all"] as const).map(period => (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={wealthPeriod === period}
                    onClick={() => setWealthPeriod(period)}
                    className={cn(
                      "h-10 rounded-full px-[18px] text-[14px] font-semibold transition-colors",
                      wealthPeriod === period ? "bg-forest text-paper" : "border-[1.5px] border-hairline-2 text-forest hover:border-forest",
                    )}
                  >
                    {period === "month" ? "Month" : period === "year" ? "Year" : "All"}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-ink-40 mt-3">Your trend will appear as you update your values over time.</p>
          )}
        </section>

        {/* Where it is: investments (the Cobalt card), cash, property */}
        <section aria-label="Where your wealth is" className="grid grid-cols-2 gap-3">
          <Link
            href="/client/wealth/investments"
            className="row-span-2 bg-forest text-paper rounded-[28px] p-[18px] flex flex-col justify-between min-h-[250px]"
          >
            <div className="flex justify-between items-start gap-2">
              <span className="tala-eyebrow text-mint">Investments</span>
              <span className="w-9 h-9 rounded-full bg-field text-forest flex-none flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            {topPlan && (
              <div className="text-[12.5px] text-mint leading-snug">
                {topPlan.nickname ?? topPlan.productName} · {topPlan.providerName}
                <span className="ml-1.5 inline-block rounded-full bg-field text-forest px-2 py-0.5 text-[11px] font-semibold align-middle">In force</span>
              </div>
            )}
            <div>
              <div className="font-display tabular-nums text-[38px] leading-none tracking-[-0.04em]">
                <CurrencyField amountUsd={investmentsTotal} compact />
              </div>
              <div className="text-[12.5px] text-mint mt-2 tabular-nums">
                {topPlan ? (
                  <><CurrencyField amountUsd={netContributed} currency={topPlan.currency} compact /> paid in · <CurrencyField amountUsd={planGain} currency={topPlan.currency} compact showSign /> growth</>
                ) : (
                  <><CurrencyField amountUsd={data.portfolio.gainLoss} compact showSign /> overall</>
                )}
              </div>
            </div>
          </Link>
          <Link href="/client/wealth/overview" className="bg-sun rounded-[28px] p-4 flex flex-col gap-4">
            <span className="tala-eyebrow text-forest">Cash</span>
            <span className="font-display tabular-nums text-[28px] leading-none tracking-[-0.04em] text-forest"><CurrencyField amountUsd={cashTotal} compact /></span>
          </Link>
          <Link href="/client/wealth/property-debts" className="bg-field rounded-[28px] p-4 flex flex-col gap-4">
            <span className="tala-eyebrow text-forest">Property</span>
            <span className="font-display tabular-nums text-[28px] leading-none tracking-[-0.04em] text-forest"><CurrencyField amountUsd={propertyTotal} compact /></span>
          </Link>
        </section>

        {recentStatementPlan && !dismissedCelebration && (
          <div className="relative bg-breeze rounded-[24px] p-[16px_56px_16px_16px] flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-sun flex-none flex items-center justify-center text-forest">
              <Check className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-forest">Statement posted</div>
              <div className="text-[13px] text-forest">{recentStatementPlan.nickname ?? recentStatementPlan.productName} was just updated.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(`celebration_dismissed_${recentStatementPlan.latestStatementDate}`, "1");
                setDismissedCelebration(true);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest hover:bg-forest/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {data.isTrackA && data.scenarioAlert && showScenarioAlert && (
          <div className="relative bg-breeze rounded-[24px] p-[16px_56px_16px_16px] flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-sun flex-none flex items-center justify-center text-forest">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-forest">{data.scenarioAlert.scenarioName ?? "Scenario Updated"}</div>
              <div className="text-[13px] text-forest tabular-nums">
                Delta: {Number(data.scenarioAlert.deltaPct) > 0 ? "+" : ""}{data.scenarioAlert.deltaPct}% to your final projection.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowScenarioAlert(false)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest hover:bg-forest/10 transition-colors"
              aria-label="Dismiss scenario update"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Sol noticed */}
        <section aria-label="Sol noticed" className="bg-forest text-paper rounded-[28px] p-5 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <Sol size="sm" animate="breathe" />
            <span className="tala-eyebrow text-field">Sol noticed</span>
          </div>
          {topGoal && goalPct != null ? (
            <div className="flex items-baseline gap-3">
              <span className="font-display tabular-nums text-[48px] leading-[0.9] tracking-[-0.04em] text-sun">{goalPct}%</span>
              <span className="text-[15px] leading-snug text-mint">of the way to {topGoal.title}</span>
            </div>
          ) : (
            <p className="text-[16px] leading-snug">{solLine}</p>
          )}
          {solDetail && <p className="text-[13.5px] leading-[1.55] text-mint text-pretty">{solDetail}</p>}
          <div className="flex gap-2 flex-wrap">
            <Link href="/client/goals/what-if" className="bg-field text-forest h-11 px-[18px] rounded-full text-[14px] font-semibold inline-flex items-center">
              See what helps
            </Link>
            <button type="button" onClick={openSolChat} className="h-11 px-[18px] rounded-full text-[14px] font-semibold border-[1.5px] border-paper/80 text-paper">
              Ask Sol
            </button>
            {advisorFirstName && (
              <Link href="/client/advisor/messages" className="h-11 px-[18px] rounded-full text-[14px] font-semibold text-mint inline-flex items-center underline underline-offset-4">
                Ask {advisorFirstName}
              </Link>
            )}
          </div>
        </section>

        {/* Monthly budget */}
        <Link
          href="/client/money"
          className="bg-surface rounded-[24px] p-3 flex items-center gap-3.5 transition-colors hover:ring-1 hover:ring-green"
        >
          <div className="w-14 h-14 rounded-2xl bg-field flex-none flex items-center justify-center text-forest">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="tala-eyebrow text-ink-40">{budgetMonthLabel} budget</div>
            <div className="text-[15px] font-semibold text-forest mt-1">
              {data.currentBudget ? (
                <>
                  <CurrencyField amountUsd={n(data.currentBudget.netSurplus)} compact showSign={n(data.currentBudget.netSurplus) < 0} /> kept
                  {" · "}{Math.round(n(data.currentBudget.savingsRatePct))}% savings rate
                </>
              ) : (
                "Set up this month’s budget"
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-forest text-paper flex-none flex items-center justify-center">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </div>
        </Link>

        {/* Goals */}
        <section aria-label="Goals" className="space-y-3 pt-1">
          <div className="flex justify-between items-baseline px-1">
            <h2 className="font-sans text-[16px] font-semibold tracking-normal text-forest">Goals</h2>
            <Link href="/client/goals/goals" className="text-[14px] font-semibold text-forest underline underline-offset-4">See all</Link>
          </div>
          {data.topGoals.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto -mx-[22px] px-[22px] md:mx-0 md:px-0 pb-1 [scrollbar-width:none]">
              {data.topGoals.map((goal, i) => {
                const pct = goal.targetAmount ? Math.min(100, Math.round((n(goal.currentAmount) / n(goal.targetAmount)) * 100)) : null;
                return (
                  <Link key={goal.id} href="/client/goals/goals" className={cn("flex-none w-[168px] rounded-[28px] p-4 flex flex-col gap-2.5", GOAL_TINTS[i % GOAL_TINTS.length])}>
                    <span className="text-[14px] font-semibold text-forest truncate">{goal.title}</span>
                    {pct != null ? (
                      <>
                        <span className="font-display tabular-nums text-[40px] leading-[0.9] tracking-[-0.04em] text-forest">{pct}%</span>
                        <span className="h-1.5 rounded-full bg-forest/20 overflow-hidden"><span className="block h-full rounded-full bg-forest" style={{ width: `${pct}%` }} /></span>
                      </>
                    ) : (
                      <span className="text-[14px] text-forest tabular-nums"><CurrencyField amountUsd={n(goal.currentAmount)} compact /> saved</span>
                    )}
                    {goal.targetDate && (
                      <span className="text-[12.5px] text-forest/80">by {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <Link href="/client/goals/goals" className="bg-surface rounded-[24px] p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-field flex items-center justify-center text-forest">
                <Target className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-[15px] font-semibold text-forest">Set a goal</div>
            </Link>
          )}
        </section>

        {/* Coming up */}
        {nextMilestone && (
          <section aria-label="Coming up" className="space-y-3 pt-1">
            <h2 className="font-sans text-[16px] font-semibold tracking-normal text-forest px-1">Coming up</h2>
            {nextMilestone && (
              <Link href="/client/goals/my-plan" className="bg-surface rounded-[24px] p-3 flex items-center gap-3.5">
                <div className="w-[68px] h-[68px] rounded-[20px] bg-field flex-none flex flex-col items-center justify-center text-forest">
                  {nextMilestone.targetDate ? (
                    <>
                      <span className="font-display tabular-nums text-[30px] leading-none">{new Date(nextMilestone.targetDate).getDate()}</span>
                      <span className="text-[11px] font-semibold tracking-[0.1em] uppercase">{new Date(nextMilestone.targetDate).toLocaleDateString("en-US", { month: "short" })}</span>
                    </>
                  ) : (
                    <Target className="h-6 w-6" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="tala-eyebrow text-ink-40">Next milestone</div>
                  <div className="text-[15px] font-semibold text-forest mt-1 truncate">{nextMilestone.title}</div>
                </div>
                <div className="w-9 h-9 rounded-full bg-forest text-paper flex-none flex items-center justify-center">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </Link>
            )}
          </section>
        )}

        <ConversionCTASection />

        {/* Wealth Score */}
        <WealthScoreCard />

        {/* Advisor card: conversion state for free users, the advisor for clients */}
        <MembershipCard />
        <AdvisorCard />
        <EngagementStrip />
      </div>
      <ClientRiskCheckSheet isOpen={showRiskCheck} onClose={() => setShowRiskCheck(false)} />
    </ClientAppShell>
  );
}
