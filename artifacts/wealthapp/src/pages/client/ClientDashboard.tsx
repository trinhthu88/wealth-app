import { useState } from "react";
import { Link } from "wouter";
import { Hourglass, TrendingUp, Target, MessageSquare, Sparkles, X, Wallet, ArrowUpRight, Check } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import Sol from "@/components/Sol";
import SolNarration from "@/components/client/SolNarration";
import CurrencyField from "@/components/shared/CurrencyField";
import WealthScoreCard from "@/components/client/dashboard/WealthScoreCard";
import ClientSetupChecklistCard from "@/components/client/ClientSetupChecklistCard";
import AdvisorCard from "@/components/client/dashboard/AdvisorCard";
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

  return (
    <ClientAppShell>
      <div className="space-y-4 pb-8">
        <ClientSetupChecklistCard onRiskCheck={() => setShowRiskCheck(true)} />
        <SmartUpgradeCard />
        <SolNarration line={solLine} detail={solDetail} advisorFirstName={advisorFirstName} className="mb-0 px-1" />

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

        {/* Net worth — the one key number on Home */}
        <Link
          href="/client/wealth/overview"
          className="block rounded-[24px] px-1 pt-2 pb-1 transition-colors hover:bg-surface/60"
        >
          <span className="tala-eyebrow text-ink-40">Net worth</span>
          <div className="font-display tabular-nums text-[56px] leading-none tracking-[-0.04em] text-forest mt-2.5">
            <CurrencyField amountUsd={netWorthSummary.netWorth} compact={Math.abs(netWorthSummary.netWorth) > 1_000_000} />
          </div>
          <div className="text-[14px] text-ink-40 mt-2.5 mb-3 tabular-nums">
            <CurrencyField amountUsd={data.portfolio.totalValue} compact /> invested · <CurrencyField amountUsd={netWorthSummary.totalAssets - data.portfolio.totalValue} compact /> other
          </div>
          <div className="h-[56px] w-full" role="img" aria-label={hasHistory ? "Net worth trend over time" : "Net worth trend will appear after more updates"}>
            {hasHistory ? (
              <svg viewBox="0 0 300 56" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {(() => {
                  const w = 300, h = 56;
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
                      <path d={area} fill="var(--forest)" fillOpacity="0.06" />
                      <path d={line} fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--forest)" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="flex h-full items-center text-[13px] text-ink-40">
                Your trend will appear as you update your values over time.
              </div>
            )}
          </div>
        </Link>

        {/* Advised plan card — the one Cobalt hero card */}
        {topPlan && (
          <Link
            href={`/client/wealth/investments/${topPlan.id}`}
            className="block bg-forest rounded-[28px] p-5 cursor-pointer"
          >
            <div className="flex justify-between items-start gap-3">
              <span className="text-[13px] font-medium text-mint min-w-0">{topPlan.nickname ?? topPlan.productName} · {topPlan.providerName}</span>
              <span className="flex-none rounded-full px-2.5 py-1 text-[12px] font-semibold text-forest bg-field">In force</span>
            </div>
            <div className="flex items-end justify-between gap-3 mt-6">
              <div className="min-w-0">
                <div className="font-display tabular-nums text-[40px] leading-none tracking-[-0.04em] text-paper">
                  <CurrencyField amountUsd={n(topPlan.latestAccountValue)} currency={topPlan.currency} compact />
                </div>
                <div className="text-[13px] text-mint mt-2 tabular-nums">
                  <CurrencyField amountUsd={netContributed} currency={topPlan.currency} compact /> paid in · <CurrencyField amountUsd={planGain} currency={topPlan.currency} compact showSign /> growth
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-field text-forest flex-none flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
          </Link>
        )}

        {/* Monthly budget — the budget lives under Home, so this card is its entry point */}
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

        {/* Wealth Score */}
        <WealthScoreCard />

        {/* Two-up: top goal + next milestone */}
        {(topGoal || nextMilestone) && (
          <section aria-label="Goals" className="space-y-3 pt-1">
            <h2 className="text-[16px] font-semibold text-forest px-1">Goals</h2>
            <div className="grid grid-cols-2 gap-3">
              {topGoal ? (
                <Link href="/client/goals/goals" className="bg-field rounded-[24px] p-4 cursor-pointer flex flex-col gap-2.5">
                  <div className="text-[14px] font-semibold text-forest truncate">{topGoal.title}</div>
                  {goalPct != null ? (
                    <>
                      <div className="font-display tabular-nums text-[32px] leading-none tracking-[-0.04em] text-forest">
                        {goalPct}<span className="text-[16px]">%</span>
                      </div>
                      <div className="h-2 rounded-full bg-forest/15 overflow-hidden">
                        <div className="h-full rounded-full bg-forest" style={{ width: `${goalPct}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="text-[14px] text-forest">In progress</div>
                  )}
                </Link>
              ) : (
                <Link href="/client/goals/goals" className="bg-surface rounded-[24px] p-4 cursor-pointer flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-10 h-10 rounded-[14px] bg-field flex items-center justify-center text-forest">
                    <Target className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="text-[14px] font-semibold text-forest">Set a goal</div>
                </Link>
              )}

              <Link href="/client/goals/my-plan" className="bg-breeze rounded-[24px] p-4 cursor-pointer flex flex-col gap-1.5 min-w-0">
                <div className="tala-eyebrow text-forest">Next milestone</div>
                <div className="text-[16px] font-semibold text-forest leading-[1.25] truncate">
                  {nextMilestone?.title ?? "Create a plan"}
                </div>
                <div className="text-[13px] text-forest tabular-nums">
                  {nextMilestone?.targetDate ? new Date(nextMilestone.targetDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </div>
              </Link>
            </div>
          </section>
        )}

        <ConversionCTASection />

        {/* Advisor card: conversion state for free users, the advisor for clients */}
        <AdvisorCard />
        <EngagementStrip />
      </div>
      <ClientRiskCheckSheet isOpen={showRiskCheck} onClose={() => setShowRiskCheck(false)} />
    </ClientAppShell>
  );
}
