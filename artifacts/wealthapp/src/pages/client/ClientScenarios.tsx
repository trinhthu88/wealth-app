// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Chart draw animation (Recharts default — keep)
// ✓ ALLOWED: Result panel CSS opacity fade after [Run scenario] (user action)
// ✗ BANNED:  Page-load stagger on any section
// ✗ BANNED:  Skeleton shimmer on inputs

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ClientAppShell from "@/components/client/AppShell";
import ScenarioSidebar, { type ScenarioSource } from "@/components/client/scenarios/ScenarioSidebar";
import ScenarioInputPanel from "@/components/client/scenarios/ScenarioInputPanel";
import ScenarioResultPanel from "@/components/client/scenarios/ScenarioResultPanel";
import ScenarioCompareView from "@/components/client/scenarios/ScenarioCompareView";
import BringUnderManagementCompare from "@/components/client/scenarios/BringUnderManagementCompare";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { useClientHoldings } from "@/hooks/useClientHoldings";
import { useScenarios } from "@/hooks/useScenarios";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { runScenario as runScenarioFn, type ScenarioResult } from "@/lib/investmentCalculations";
import type { DashboardGoal } from "@/hooks/useDashboardData";
import type { ScenarioRun } from "@/hooks/useScenarios";

const MODES = [
  { id: "advised", label: "Advised scenarios" },
  { id: "self", label: "Bring under management" },
] as const;

export default function ClientScenarios() {
  const [location] = useLocation();
  const { user, isLoaded } = useUser();
  const [mode, setMode] = useState<string>("advised");

  const { plans, totalAdvisedValue } = useAdvisedPlans();
  const { holdings } = useClientHoldings();
  const { savedScenarios, advisorScenarios, saveScenario, deleteScenario, markAdvisorScenarioViewed } = useScenarios();

  const goalsQuery = useQuery<DashboardGoal[]>({
    queryKey: ["dashboard-goals"],
    queryFn: () => apiFetch("/client/dashboard/goals"),
    enabled: isLoaded && !!user,
  });
  const goals = goalsQuery.data ?? [];

  const [selectedSource, setSelectedSource] = useState<ScenarioSource | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ScenarioResult | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // Total monthly from all RSP plans
  const totalMonthly = plans.reduce((s, p) => s + parseFloat(p.annualPremium) / 12, 0);

  // Handle ?highlight=[id] URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get("highlight");
    if (highlightId && advisorScenarios.length > 0) {
      const run = advisorScenarios.find(r => r.id === highlightId);
      if (run) {
        handleLoadAdvisor(run);
        markAdvisorScenarioViewed(run.id);
      }
    }
  }, [advisorScenarios.length]);

  function handleLoadSaved(run: ScenarioRun) {
    const params = run.parameters as any;
    if (!params?.type) return;
    try {
      const result = runScenarioFn(params);
      setCurrentResult(result);
      setSelectedType(params.type);
      // Set a generic source
      setSelectedSource({
        id: run.id,
        label: run.scenarioName ?? "Loaded scenario",
        currentValue: params.currentValue ?? 0,
        currentMonthly: params.currentMonthly ?? 0,
        kind: "total",
      });
    } catch { /* ignore bad params */ }
  }

  function handleLoadAdvisor(run: ScenarioRun) {
    handleLoadSaved(run);
  }

  function handleReset() {
    setSelectedSource(null);
    setSelectedType(null);
    setCurrentResult(null);
    setShowCompare(false);
  }

  return (
    <ClientAppShell>
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em] mb-1">What if</h1>
            <div className="text-[14px] text-ink-40">Move a lever, watch your goals move</div>
          </div>
          {mode === "advised" && (selectedSource || selectedType || currentResult) && (
            <button
              onClick={handleReset}
              className="text-sm text-ink-40 hover:text-forest transition-colors"
            >
              ← New scenario
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-track rounded-xl p-1 w-fit mb-[22px]">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                mode === m.id ? "bg-surface text-forest shadow-sm" : "text-ink-40 hover:text-ink-60"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "self" ? (
          <BringUnderManagementCompare holdings={holdings} />
        ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-[300px] lg:shrink-0">
            <ScenarioSidebar
              plans={plans}
              goals={goals}
              totalAdvisedValue={totalAdvisedValue}
              totalMonthly={totalMonthly}
              selectedSource={selectedSource}
              onSelectSource={s => { setSelectedSource(s); setCurrentResult(null); }}
              selectedType={selectedType}
              onSelectType={t => { setSelectedType(t); setCurrentResult(null); }}
              savedScenarios={savedScenarios}
              advisorScenarios={advisorScenarios}
              onLoadSaved={handleLoadSaved}
              onDeleteSaved={deleteScenario}
              onLoadAdvisor={handleLoadAdvisor}
              onAdvisorViewed={markAdvisorScenarioViewed}
            />
          </div>

          {/* Main panel */}
          <div className="flex-1 min-w-0 space-y-5">
            {!selectedSource || !selectedType ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-surface border border-hairline rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                <BarChart2 className="h-10 w-10 text-green/40 mb-3" />
                <p className="text-sm font-semibold text-forest">Choose a source and scenario type</p>
                <p className="text-xs text-ink-30 mt-1">to see your projection</p>
              </div>
            ) : (
              <>
                {/* Input panel */}
                <div className="bg-surface rounded-[26px] p-[20px_22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                  <ScenarioInputPanel
                    source={selectedSource}
                    scenarioType={selectedType}
                    goals={goals}
                    onRun={setCurrentResult}
                    runScenario={runScenarioFn}
                  />
                </div>

                {/* Result panel */}
                {currentResult && (
                  <>
                    <ScenarioResultPanel
                      result={currentResult}
                      onSave={(name) => saveScenario(currentResult, name).then(() => {})}
                      onCompare={() => setShowCompare(v => !v)}
                      onReset={handleReset}
                      showCompare={showCompare}
                    />

                    {showCompare && (
                      <ScenarioCompareView
                        current={currentResult}
                        saved={savedScenarios}
                        onSaveCurrent={() => {}}
                        onClose={() => setShowCompare(false)}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </ClientAppShell>
  );
}
