import { useState } from "react";
import { Link } from "wouter";
import { Hourglass, TrendingUp, Target, MessageSquare, Sparkles, X, ChevronRight } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import Sol from "@/components/Sol";
import CurrencyField from "@/components/shared/CurrencyField";
import CurrencyToggle from "@/components/client/CurrencyToggle";
import WealthScoreCard from "@/components/client/dashboard/WealthScoreCard";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useProfile } from "@/hooks/useProfile";
import { useNetWorthSummary } from "@/hooks/useNetWorthSummary";
import { useNetWorthTrend } from "@/hooks/useNetWorthTrend";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { cn } from "@/lib/utils";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

interface FocusItem {
  id: string;
  label: string;
  href: string;
}

function n(v: string | null | undefined) { return parseFloat(v ?? "0") || 0; }

export default function ClientDashboard() {
  const data = useDashboardData();
  const { profile } = useProfile();
  const netWorthSummary = useNetWorthSummary();
  const { trendDelta, loading: trendLoading } = useNetWorthTrend();
  const { activity, loading: activityLoading } = useRecentActivity(data.plans, 3);
  const [showScenarioAlert, setShowScenarioAlert] = useState(true);

  if (data.isLoading) {
    return (
      <ClientAppShell>
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-forest/20 rounded-[26px]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-surface rounded-[22px]" />
            <div className="h-24 bg-surface rounded-[22px]" />
          </div>
          <div className="h-24 bg-surface rounded-[26px]" />
        </div>
      </ClientAppShell>
    );
  }

  const firstName = profile?.fullName?.split(" ")[0] ?? "Client";
  const todayLabel = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

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

  // ── "Your focus this month" — up to 3 items, most important first ────────
  const focusItems: FocusItem[] = [];

  const totalIncome = n(data.currentBudget?.totalIncome);
  if (!data.currentBudget || totalIncome === 0) {
    focusItems.push({ id: "budget", label: "Log your monthly budget", href: "/client/budget" });
  }

  const now = Date.now();
  for (const g of data.topGoals) {
    if (!g.targetDate || !g.targetAmount) continue;
    const target = n(g.targetAmount);
    if (target <= 0) continue;
    const start = new Date(g.createdAt).getTime();
    const end = new Date(g.targetDate).getTime();
    if (!(end > start)) continue;
    const elapsedFrac = Math.min(1, Math.max(0, (now - start) / (end - start)));
    const progressFrac = n(g.currentAmount) / target;
    if (progressFrac < elapsedFrac) {
      focusItems.push({ id: `goal-${g.id}`, label: `Goal "${g.title}" is behind schedule`, href: "/client/goals" });
    }
  }

  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
  const hasStaleStatement = data.plans.some(
    p => p.status === "inforce" && p.latestStatementDate && new Date(p.latestStatementDate).getTime() < ninetyDaysAgo
  );
  if (hasStaleStatement) {
    focusItems.push({ id: "statement", label: "New statement may be ready — check with your advisor", href: "/client/portfolio" });
  }

  const shownFocusItems = focusItems.slice(0, 3);
  const netWorthDelta = trendLoading ? null : trendDelta;
  const surplus = n(data.currentBudget?.netSurplus);

  return (
    <ClientAppShell>
      <div className="space-y-[14px] pb-8">
        {/* Top band */}
        <div className="-mx-[22px] md:-mx-[26px] -mt-4 md:mt-0 bg-forest text-paper px-[22px] md:px-[26px] pt-[calc(env(safe-area-inset-top)+22px)] pb-[24px] rounded-b-[28px] md:rounded-[26px] md:mb-[6px]">
          <div className="flex items-start justify-between gap-3 mb-4">
            <span className="text-[13px] font-medium text-mint">{getGreeting()}, {firstName}</span>
            <span className="text-[13px] font-medium text-mint">{todayLabel}</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold text-mint uppercase tracking-wide mb-1">Net worth</div>
              <div className="font-display text-[36px] font-semibold tracking-[-0.02em] leading-none tabular-nums text-paper">
                <CurrencyField amountUsd={netWorthSummary.netWorth} compact={Math.abs(netWorthSummary.netWorth) > 1_000_000} />
              </div>
              {netWorthDelta != null && netWorthDelta !== 0 && (
                <div className={cn("text-[13px] font-semibold mt-2", netWorthDelta >= 0 ? "text-green-300" : "text-clay")}>
                  {netWorthDelta >= 0 ? "+" : "-"}
                  <CurrencyField amountUsd={Math.abs(netWorthDelta)} compact /> vs last month
                </div>
              )}
            </div>
            <CurrencyToggle />
          </div>
        </div>

        {/* Scenario Alert (Track A) */}
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
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-mint transition-colors hover:bg-white/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
              aria-label="Dismiss scenario update"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Row 1 — stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/client/portfolio"
            className="bg-surface rounded-[22px] p-[16px_18px] shadow-[0_2px_14px_rgba(20,52,42,.06)] block transition-colors hover:ring-1 hover:ring-green"
          >
            <div className="text-[12px] font-semibold text-ink-40 mb-1">Portfolio value</div>
            <div className="font-display text-[19px] font-semibold text-forest tabular-nums leading-none mb-1.5">
              <CurrencyField amountUsd={data.portfolio.totalValue} compact />
            </div>
            {data.portfolio.gainLossPct !== 0 && (
              <div className={cn("text-[12px] font-semibold", data.portfolio.gainLossPct >= 0 ? "text-green" : "text-clay")}>
                {data.portfolio.gainLossPct >= 0 ? "+" : ""}{data.portfolio.gainLossPct.toFixed(1)}%
              </div>
            )}
          </Link>
          <Link
            href="/client/budget"
            className="bg-surface rounded-[22px] p-[16px_18px] shadow-[0_2px_14px_rgba(20,52,42,.06)] block transition-colors hover:ring-1 hover:ring-green"
          >
            <div className="text-[12px] font-semibold text-ink-40 mb-1">Monthly surplus</div>
            <div className={cn("font-display text-[19px] font-semibold tabular-nums leading-none", surplus >= 0 ? "text-forest" : "text-clay")}>
              <CurrencyField amountUsd={surplus} compact />
            </div>
          </Link>
        </div>

        {/* Row 2 — Wealth Score */}
        <WealthScoreCard />

        {/* Row 3 — Needs attention */}
        <div className="bg-surface rounded-[26px] p-[18px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <div className="font-display text-[16px] font-semibold text-forest mb-2">Your focus this month</div>
          {shownFocusItems.length === 0 ? (
            <p className="text-[13.5px] text-ink-40 py-1">You're on track — nothing needs attention right now.</p>
          ) : (
            <div>
              {shownFocusItems.map(item => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-hairline last:border-0"
                >
                  <span className="text-[13.5px] text-forest pr-2">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-ink-30 shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Row 4 — Recent activity */}
        <div className="bg-surface rounded-[26px] p-[18px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <div className="font-display text-[16px] font-semibold text-forest mb-2">Recent activity</div>
          {activityLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map(i => <div key={i} className="h-10 bg-hairline/60 animate-pulse rounded-lg" />)}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-[13.5px] text-ink-40 py-1">No recent transactions yet.</p>
          ) : (
            <div>
              {activity.map(a => {
                const amt = n(a.netAmount);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-hairline last:border-0">
                    <div className="min-w-0 pr-2">
                      <p className="text-[13.5px] text-forest truncate">{a.description}</p>
                      <p className="text-[12px] text-ink-40 truncate">
                        {a.planName} · {new Date(a.transactionDate + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    <span className={cn("text-[13.5px] font-semibold tabular-nums shrink-0", amt >= 0 ? "text-green" : "text-clay")}>
                      <CurrencyField amountUsd={amt} compact showSign />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                  {data.advisorName.split(" ").map(p => p[0]).join("")}
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
