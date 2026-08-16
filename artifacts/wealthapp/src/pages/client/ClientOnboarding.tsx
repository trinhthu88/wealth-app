// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: BottomSheet spring animation (open/close)
// ✓ ALLOWED: Single item appearing after user action
// ✓ ALLOWED: Phase3Screen8Complete checkmark scale-in (single entrance, allowed)
// ✗ BANNED:  Page-load stagger on any screen content
// ✗ BANNED:  Slide/fade transitions between screens (screens swap immediately)
// ✗ BANNED:  Loading skeletons on onboarding screens

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { useClientTrack } from "@/hooks/useClientTrack";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { convertCurrency } from "@/lib/currencyUtils";
import OnboardingShell from "@/components/client/onboarding/OnboardingShell";
import OnboardingNav from "@/components/client/onboarding/OnboardingNav";
import Phase1Screen1Basics, { type Screen1Data } from "@/components/client/onboarding/phases/Phase1Screen1Basics";
import Phase1Screen2Income, { type Screen2Data } from "@/components/client/onboarding/phases/Phase1Screen2Income";
import Phase2Screen3TrackA from "@/components/client/onboarding/phases/Phase2Screen3TrackA";
import Phase2Screen3TrackB from "@/components/client/onboarding/phases/Phase2Screen3TrackB";
import Phase2Screen4Holdings from "@/components/client/onboarding/phases/Phase2Screen4Holdings";
import Phase2Screen5Summary from "@/components/client/onboarding/phases/Phase2Screen5Summary";
import Phase3Screen6Goal, { type Screen6Data } from "@/components/client/onboarding/phases/Phase3Screen6Goal";
import Phase3Screen7Budget, { type ExpenseData } from "@/components/client/onboarding/phases/Phase3Screen7Budget";
import Phase3Screen8Complete from "@/components/client/onboarding/phases/Phase3Screen8Complete";
import type { NewHolding } from "@/components/client/onboarding/HoldingMiniForm";

const TOTAL_SCREENS = 8;

interface OnboardingState {
  currentScreen: number;
  // Screen 1
  screen1: Screen1Data;
  // Screen 2
  screen2: Screen2Data;
  // Screen 3 (track B gate)
  hasExistingInvestments: boolean | null;
  // Screen 4
  addedHoldings: NewHolding[];
  // Screen 6
  screen6: Screen6Data;
  // Screen 7
  expenses: ExpenseData;
  extraInvestment: number;
}

const DEFAULT_STATE: OnboardingState = {
  currentScreen: 1,
  screen1: { fullName: "", dateOfBirth: "", countryCode: "", isExpat: false, preferredCurrency: "USD" },
  screen2: { monthlyIncome: 0, incomeCurrency: "USD", incomeType: [], isStableIncome: true },
  hasExistingInvestments: null,
  addedHoldings: [],
  screen6: { goalType: "", goalName: "", goalTargetAmount: "", goalCurrency: "USD", goalTargetDate: "" },
  expenses: { housing: 0, food: 0, transport: 0, utilities: 0, entertainment: 0, other: 0 },
  extraInvestment: 0,
};

function storageKey(userId: string) { return `onboarding_progress_${userId}`; }

export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const { profile } = useProfile();
  const { isTrackA, isTrackB, hasPendingAdvisorSetup, loading: trackLoading } = useClientTrack();
  const { plans } = useAdvisedPlans();

  const [state, setState] = useState<OnboardingState>(() => {
    if (!user?.id) return DEFAULT_STATE;
    try {
      const saved = localStorage.getItem(storageKey(user.id));
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_STATE;
  });
  const [saving, setSaving] = useState(false);

  // Restore toast
  useEffect(() => {
    if (!user?.id) return;
    const saved = localStorage.getItem(storageKey(user.id));
    if (saved) {
      const parsed = JSON.parse(saved) as OnboardingState;
      if (parsed.currentScreen > 1) {
        toast.info("Resuming where you left off…");
      }
    }
    // Sync preferred currency from profile
    if (profile?.preferredCurrency) {
      setState(s => ({
        ...s,
        screen1: { ...s.screen1, preferredCurrency: profile.preferredCurrency as any ?? "USD" },
        screen2: { ...s.screen2, incomeCurrency: profile.preferredCurrency as any ?? "USD" },
        screen6: { ...s.screen6, goalCurrency: profile.preferredCurrency ?? "USD" },
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Pre-fill name from Clerk
  useEffect(() => {
    if (profile?.fullName && !state.screen1.fullName) {
      setState(s => ({ ...s, screen1: { ...s.screen1, fullName: profile.fullName ?? "" } }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.fullName]);

  // Auto-save on state change
  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(storageKey(user.id), JSON.stringify(state));
  }, [state, user?.id]);

  const goTo = useCallback((screen: number) => {
    setState(s => ({ ...s, currentScreen: screen }));
  }, []);

  // ── Navigation logic ─────────────────────────────────────────────────────

  function getNextScreen(from: number): number {
    if (from === 3) {
      // Track A always goes to screen 4; Track B depends on gate answer
      if (isTrackA) return 4;
      if (state.hasExistingInvestments === false) return 5;
      return 4;
    }
    return from + 1;
  }

  function getPrevScreen(from: number): number {
    if (from === 5 && isTrackB && state.hasExistingInvestments === false) return 3;
    return from - 1;
  }

  // ── Per-screen save calls ────────────────────────────────────────────────

  async function saveScreen1() {
    setSaving(true);
    try {
      await apiFetch("/client/profile/basics", {
        method: "PUT",
        body: JSON.stringify({
          fullName: state.screen1.fullName,
          countryCode: state.screen1.countryCode,
          isExpat: state.screen1.isExpat,
          preferredDisplayCurrency: state.screen1.preferredCurrency,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveScreen2() {
    setSaving(true);
    try {
      // Convert income to USD for storage
      const incomeInUsd = state.screen2.incomeCurrency !== "USD"
        ? convertCurrency(state.screen2.monthlyIncome, state.screen2.incomeCurrency, "USD")
        : state.screen2.monthlyIncome;

      const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
      await apiFetch("/client/budget", {
        method: "POST",
        body: JSON.stringify({
          month: currentMonth,
          currency: state.screen2.incomeCurrency,
          primaryIncome: incomeInUsd,
          totalIncome: incomeInUsd,
          totalExpenses: 0, totalInvestments: 0, netSurplus: incomeInUsd, savingsRatePct: 100,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveScreen4Holdings() {
    setSaving(true);
    try {
      // Holdings are saved individually when added via HoldingMiniForm — just advance
    } finally {
      setSaving(false);
    }
  }

  async function saveScreen6Goal() {
    const { goalType, goalName, goalTargetAmount, goalCurrency, goalTargetDate } = state.screen6;
    if (!goalType) return;
    setSaving(true);
    try {
      const targetDate = goalTargetDate ? goalTargetDate + "-01" : null;
      await apiFetch("/goals", {
        method: "POST",
        body: JSON.stringify({
          title: goalName || goalType,
          goalType,
          targetAmount: goalTargetAmount ? parseFloat(goalTargetAmount) : null,
          targetDate,
          currency: goalCurrency,
          status: "on_track",
          priority: "high",
        }),
      });
    } catch (e: any) {
      // Ignore duplicate error — goal may already exist if user resumed
      if (!e?.message?.includes("limit")) throw e;
    } finally {
      setSaving(false);
    }
  }

  async function saveScreen7Budget() {
    setSaving(true);
    try {
      const incomeInUsd = state.screen2.incomeCurrency !== "USD"
        ? convertCurrency(state.screen2.monthlyIncome, state.screen2.incomeCurrency, "USD")
        : state.screen2.monthlyIncome;
      const advisedMonthly = isTrackA
        ? plans.reduce((s, p) => s + (parseFloat(p.annualPremium) || 0) / 12, 0)
        : 0;
      const totalInvestments = advisedMonthly + state.extraInvestment;
      const totalExpenses = Object.values(state.expenses).reduce((s, v) => s + v, 0);
      const netSurplus = incomeInUsd - totalExpenses - totalInvestments;
      const savingsRatePct = incomeInUsd > 0 ? (netSurplus / incomeInUsd) * 100 : 0;

      const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
      await apiFetch("/client/budget", {
        method: "POST",
        body: JSON.stringify({
          month: currentMonth,
          currency: state.screen2.incomeCurrency,
          primaryIncome: incomeInUsd,
          housing: state.expenses.housing,
          foodDining: state.expenses.food,
          transport: state.expenses.transport,
          utilities: state.expenses.utilities,
          entertainment: state.expenses.entertainment,
          otherExpenses: state.expenses.other,
          totalIncome: incomeInUsd,
          totalExpenses,
          totalInvestments,
          netSurplus,
          savingsRatePct,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await apiFetch("/client/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({ preferredDisplayCurrency: state.screen1.preferredCurrency }),
      });
      if (user?.id) localStorage.removeItem(storageKey(user.id));
      navigate("/client/dashboard");
    } finally {
      setSaving(false);
    }
  }

  // ── Continue handler ─────────────────────────────────────────────────────

  async function handleContinue() {
    const screen = state.currentScreen;
    try {
      if (screen === 1) await saveScreen1();
      if (screen === 2) await saveScreen2();
      if (screen === 7) await saveScreen7Budget();

      if (screen === 6) {
        await saveScreen6Goal();
      }

      if (screen === TOTAL_SCREENS) {
        await handleComplete();
        return;
      }

      goTo(getNextScreen(screen));
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong. Please try again.");
    }
  }

  async function addHolding(holding: NewHolding) {
    const saved = await apiFetch<{ id: string }>("/client/holdings", {
      method: "POST",
      body: JSON.stringify(holding),
    });
    setState(s => ({ ...s, addedHoldings: [...s.addedHoldings, { ...holding, _id: (saved as any).id }] }));
  }

  function removeHolding(index: number) {
    setState(s => ({ ...s, addedHoldings: s.addedHoldings.filter((_, i) => i !== index) }));
  }

  // ── canContinue per screen ────────────────────────────────────────────────

  function canContinue(): boolean {
    const { screen1, screen2 } = state;
    switch (state.currentScreen) {
      case 1: return screen1.fullName.trim().length >= 2 && !!screen1.dateOfBirth && !!screen1.countryCode;
      case 2: return screen2.monthlyIncome > 0 && screen2.incomeType.length > 0;
      case 3: return isTrackA ? true : state.hasExistingInvestments !== null;
      case 4: return true;
      case 5: return true;
      case 6: return !!state.screen6.goalType;
      case 7: return true;
      case 8: return true;
      default: return true;
    }
  }

  // ── Calculate summary values for Screen 8 ────────────────────────────────

  const advisedValue = plans.reduce((s, p) => s + (parseFloat(p.latestAccountValue) || 0), 0);
  const selfValue = state.addedHoldings.reduce((s, h) => {
    if (h.holdingType === "property") return s + (h.currentEstimatedValue ?? h.purchasePrice ?? 0);
    if (h.holdingType === "cash") return s + (h.currentBalance ?? 0);
    if (h.holdingType === "pension") return s + (h.currentBalancePension ?? 0);
    if (h.holdingType === "other") return s + (h.currentValueOther ?? 0);
    return s + (h.unitsHeld ?? 0) * (h.averageCostPrice ?? 0);
  }, 0);
  const totalPortfolio = advisedValue + selfValue;

  const incomeInUsd = state.screen2.incomeCurrency !== "USD"
    ? convertCurrency(state.screen2.monthlyIncome, state.screen2.incomeCurrency, "USD")
    : state.screen2.monthlyIncome;
  const totalExpenses = Object.values(state.expenses).reduce((s, v) => s + v, 0);
  const advisedMonthly = isTrackA ? plans.reduce((s, p) => s + (parseFloat(p.annualPremium) || 0) / 12, 0) : 0;
  const totalInvestments = advisedMonthly + state.extraInvestment;
  const netSurplus = incomeInUsd - totalExpenses - totalInvestments;
  const savingsRatePct = incomeInUsd > 0 ? (netSurplus / incomeInUsd) * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  const screen = state.currentScreen;

  const nav = (
    <OnboardingNav
      showBack={screen > 1}
      onBack={() => goTo(getPrevScreen(screen))}
      onContinue={handleContinue}
      canContinue={canContinue()}
      isLoading={saving}
      showSkip={screen === 4}
      onSkip={() => goTo(getNextScreen(screen))}
      continueLabel={screen === TOTAL_SCREENS ? "Go to my dashboard" : "Continue"}
    />
  );

  return (
    <OnboardingShell currentScreen={screen} totalScreens={TOTAL_SCREENS} nav={nav}>
      {screen === 1 && (
        <Phase1Screen1Basics
          data={state.screen1}
          onChange={updates => setState(s => ({ ...s, screen1: { ...s.screen1, ...updates } }))}
        />
      )}

      {screen === 2 && (
        <Phase1Screen2Income
          data={state.screen2}
          preferredCurrency={state.screen1.preferredCurrency}
          onChange={updates => setState(s => ({ ...s, screen2: { ...s.screen2, ...updates } }))}
        />
      )}

      {screen === 3 && !trackLoading && (
        isTrackA ? (
          <Phase2Screen3TrackA plans={plans} hasPendingAdvisorSetup={hasPendingAdvisorSetup} />
        ) : (
          <Phase2Screen3TrackB
            hasExistingInvestments={state.hasExistingInvestments}
            onChange={v => setState(s => ({ ...s, hasExistingInvestments: v }))}
          />
        )
      )}

      {screen === 4 && (
        <Phase2Screen4Holdings
          isTrackA={isTrackA}
          addedHoldings={state.addedHoldings}
          preferredCurrency={state.screen1.preferredCurrency}
          onAdd={addHolding}
          onRemove={removeHolding}
        />
      )}

      {screen === 5 && (
        <Phase2Screen5Summary
          isTrackA={isTrackA}
          advisedPlans={plans}
          addedHoldings={state.addedHoldings}
          preferredCurrency={state.screen1.preferredCurrency}
        />
      )}

      {screen === 6 && (
        <Phase3Screen6Goal
          data={state.screen6}
          preferredCurrency={state.screen1.preferredCurrency}
          onChange={updates => setState(s => ({ ...s, screen6: { ...s.screen6, ...updates } }))}
        />
      )}

      {screen === 7 && (
        <Phase3Screen7Budget
          monthlyIncome={state.screen2.monthlyIncome}
          incomeCurrency={state.screen2.incomeCurrency}
          isTrackA={isTrackA}
          advisedPlans={plans}
          expenses={state.expenses}
          extraInvestment={state.extraInvestment}
          preferredCurrency={state.screen1.preferredCurrency}
          onExpenseChange={(key, value) => setState(s => ({ ...s, expenses: { ...s.expenses, [key]: value } }))}
          onExtraInvestmentChange={v => setState(s => ({ ...s, extraInvestment: v }))}
        />
      )}

      {screen === 8 && (
        <Phase3Screen8Complete
          isTrackA={isTrackA}
          advisedPlans={plans}
          totalPortfolioValue={totalPortfolio}
          goalName={state.screen6.goalName}
          savingsRate={savingsRatePct}
          preferredCurrency={state.screen1.preferredCurrency}
          onComplete={handleContinue}
          isLoading={saving}
        />
      )}
    </OnboardingShell>
  );
}
