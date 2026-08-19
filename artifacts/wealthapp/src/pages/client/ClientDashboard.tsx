// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: None. This page has no animations.
// ✗ BANNED:  Page-load stagger on any section
// ✗ BANNED:  Hero gradient cards (#042C53 → #0a4a8a)
// ✗ BANNED:  initial={{ opacity: 0, y: 12 }} on any element
// ✗ BANNED:  Skeleton shimmer on individual section cards

import ClientAppShell from "@/components/client/AppShell";
import DashboardWelcome from "@/components/client/dashboard/DashboardWelcome";
import DashboardPendingState from "@/components/client/dashboard/DashboardPendingState";
import PortfolioSnapshotSection from "@/components/client/dashboard/sections/PortfolioSnapshotSection";
import NetWorthRingSection from "@/components/client/dashboard/sections/NetWorthRingSection";
import BudgetSnapshotSection from "@/components/client/dashboard/sections/BudgetSnapshotSection";
import GoalsProgressSection from "@/components/client/dashboard/sections/GoalsProgressSection";
import ScenarioAlertSection from "@/components/client/dashboard/sections/ScenarioAlertSection";
import ConversionCTASection from "@/components/client/dashboard/sections/ConversionCTASection";
import QuickActionsSection from "@/components/client/dashboard/sections/QuickActionsSection";
import { useDashboardData } from "@/hooks/useDashboardData";

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      </div>
      <div className="h-36 bg-slate-100 rounded-xl animate-pulse" />
      <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
    </div>
  );
}

export default function ClientDashboard() {
  const data = useDashboardData();

  const planNickname = data.plans[0]?.nickname ?? data.plans[0]?.productName;

  return (
    <ClientAppShell>
      <div className="max-w-[900px] mx-auto space-y-6">
        <DashboardWelcome
          isTrackA={data.isTrackA}
          advisorName={data.advisorName}
        />

        {data.isLoading ? (
          <LoadingState />
        ) : data.hasPendingAdvisorSetup ? (
          <DashboardPendingState advisorName={data.advisorName} />
        ) : (
          <>
            <PortfolioSnapshotSection
              totalValue={data.portfolio.totalValue}
              gainLoss={data.portfolio.gainLoss}
              gainLossPct={data.portfolio.gainLossPct}
              cagr={data.portfolio.cagr}
              isTrackA={data.isTrackA}
              displayCurrency={data.preferredCurrency}
            />

            <GoalsProgressSection
              goals={data.topGoals}
              totalGoals={data.topGoals.length}
            />

            {data.isTrackA && data.scenarioAlert && (
              <ScenarioAlertSection alert={data.scenarioAlert} />
            )}

            {data.isTrackB && (
              <ConversionCTASection
                totalPortfolioValue={data.portfolio.totalValue}
                overallCagr={data.portfolio.cagr}
                topGoals={data.topGoals}
                displayCurrency={data.preferredCurrency}
              />
            )}

            <QuickActionsSection isTrackA={data.isTrackA} advisorName={data.advisorName} />
          </>
        )}
      </div>
    </ClientAppShell>
  );
}
