// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Summary panel numbers updating smoothly (CSS transition on bars)
// ✗ BANNED:  Page-load stagger on any section
// ✗ BANNED:  Skeleton shimmer on individual input fields

import { useState, useEffect, useRef } from "react";
import ClientAppShell from "@/components/client/AppShell";
import BudgetMonthSelector from "@/components/client/budget/BudgetMonthSelector";
import BudgetInputForm, { type BudgetFormState } from "@/components/client/budget/BudgetInputForm";
import BudgetSummaryPanel from "@/components/client/budget/BudgetSummaryPanel";
import SurplusCTA from "@/components/client/budget/SurplusCTA";
import GoalFundingGaps from "@/components/client/budget/GoalFundingGaps";
import BudgetHistoryChart from "@/components/client/budget/BudgetHistoryChart";
import BudgetTrackBCTA from "@/components/client/budget/BudgetTrackBCTA";
import { useClientBudget, type InvestmentContribution } from "@/hooks/useClientBudget";
import { useClientHoldings } from "@/hooks/useClientHoldings";

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const EMPTY_FORM: BudgetFormState = {
  primaryIncome: "", secondaryIncome: "", rentalIncome: "", otherIncome: "",
  housing: "", utilities: "", transport: "", insurance: "",
  foodDining: "", entertainment: "", shopping: "", health: "", education: "", otherExpenses: "",
  otherInvestments: "",
};

function rowToForm(data: Record<string, string | null | undefined> | null): BudgetFormState {
  if (!data) return { ...EMPTY_FORM };
  const s = (v: unknown) => v != null ? String(parseFloat(String(v)) || "") : "";
  return {
    primaryIncome: s(data.primaryIncome),
    secondaryIncome: s(data.secondaryIncome),
    rentalIncome: s(data.rentalIncome),
    otherIncome: s(data.otherIncome),
    housing: s(data.housing),
    utilities: s(data.utilities),
    transport: s(data.transport),
    insurance: s(data.insurance),
    foodDining: s(data.foodDining),
    entertainment: s(data.entertainment),
    shopping: s(data.shopping),
    health: s(data.health),
    education: s(data.education),
    otherExpenses: s(data.otherExpenses),
    otherInvestments: "", // always empty — other investments not separately stored
  };
}

function n(s: string) { return parseFloat(s) || 0; }

export default function ClientBudget() {
  const { holdings } = useClientHoldings();
  const hasSyncedContributions = useRef(false);

  // Handle ?month= URL param
  const urlMonth = (() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("month");
    return m ? m + "-01" : undefined;
  })();

  const currentMonthStr = new Date().toISOString().slice(0, 7) + "-01";
  const [selectedMonth, setSelectedMonth] = useState<string>(urlMonth ?? currentMonthStr);

  const {
    currentMonth: monthData,
    months,
    loading,
    saving,
    saveMonth,
    syncInvestmentContributions,
  } = useClientBudget(selectedMonth);

  const [form, setForm] = useState<BudgetFormState>({ ...EMPTY_FORM });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync form from loaded month data
  useEffect(() => {
    if (!loading) {
      setForm(rowToForm(monthData as any));
      setIsDirty(false);
    }
  }, [monthData?.id, loading]);

  // Determine read-only: past months default to read-only until explicitly unlocked
  useEffect(() => {
    const isPast = selectedMonth !== currentMonthStr;
    setIsReadOnly(isPast && !!monthData);
  }, [selectedMonth, currentMonthStr, monthData?.id]);

  // Auto-sync on mount
  useEffect(() => {
    if (hasSyncedContributions.current) return;
    hasSyncedContributions.current = true;
    syncInvestmentContributions().catch(() => {});
  }, [syncInvestmentContributions]);

  // Warn on unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved budget changes.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleChange(field: keyof BudgetFormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setIsDirty(true);
  }

  // Auto-populate rental income from property holdings
  useEffect(() => {
    if (!monthData) {
      const propRental = holdings
        .filter(h => h.holdingType === "property" && parseFloat(h.monthlyRentalIncome ?? "0") > 0)
        .reduce((s, h) => s + (parseFloat(h.monthlyRentalIncome ?? "0") || 0), 0);
      if (propRental > 0) {
        setForm(f => ({ ...f, rentalIncome: String(propRental) }));
      }
    }
  }, [holdings.length, monthData?.id]);

  const syncedContributions = (monthData?.investmentContributions ?? []) as InvestmentContribution[];

  // Live totals for summary panel
  const income = n(form.primaryIncome) + n(form.secondaryIncome) + n(form.rentalIncome) + n(form.otherIncome);
  const expenses = n(form.housing) + n(form.utilities) + n(form.transport) + n(form.insurance)
    + n(form.foodDining) + n(form.entertainment) + n(form.shopping) + n(form.health) + n(form.education) + n(form.otherExpenses);
  const syncedInvest = syncedContributions.reduce((s, c) => s + c.amount, 0);
  const totalInvestments = syncedInvest + n(form.otherInvestments);
  const surplus = income - expenses - totalInvestments;

  async function handleSave() {
    const all: InvestmentContribution[] = [
      ...syncedContributions,
      ...(n(form.otherInvestments) > 0 ? [{
        label: "Other investments",
        amount: n(form.otherInvestments),
        source_id: "manual",
        source_type: "manual",
      }] : []),
    ];

    try {
      await saveMonth({
        month: selectedMonth,
        currency: "USD",
        primaryIncome: form.primaryIncome || "0",
        secondaryIncome: form.secondaryIncome || "0",
        rentalIncome: form.rentalIncome || "0",
        otherIncome: form.otherIncome || "0",
        housing: form.housing || "0",
        utilities: form.utilities || "0",
        transport: form.transport || "0",
        insurance: form.insurance || "0",
        foodDining: form.foodDining || "0",
        entertainment: form.entertainment || "0",
        shopping: form.shopping || "0",
        health: form.health || "0",
        education: form.education || "0",
        otherExpenses: form.otherExpenses || "0",
        investmentContributions: all,
      } as any);
      setIsDirty(false);
    } catch {
      // mutation's onError already shows the toast
    }
  }

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
    setIsReadOnly(false);
  }

  const [daysLeft] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
  });

  if (loading) {
    return (
      <ClientAppShell>
        <div className="space-y-[14px]">
          <div className="h-48 bg-surface animate-pulse rounded-[28px]" />
          <div className="h-64 bg-surface animate-pulse rounded-[26px]" />
        </div>
      </ClientAppShell>
    );
  }

  return (
    <ClientAppShell>
      <div className="space-y-[14px] pb-12">
        {/* Header */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em]">
              {monthLabel(selectedMonth)}
            </h1>
            {isDirty && (
              <span className="text-[12px] text-clay font-medium bg-clay-tint px-2.5 py-0.5 rounded-full">Unsaved changes</span>
            )}
          </div>
          <div className="text-[14px] text-ink-40">{daysLeft} days left in the month</div>
        </div>

        {/* Month selector */}
        <div className="mb-[20px]">
          <BudgetMonthSelector
            selectedMonth={selectedMonth}
            months={months}
            onChange={handleMonthChange}
          />
        </div>

        {/* Main 2-col layout */}
        <div className="flex flex-col lg:flex-row gap-[14px]">
          {/* Input form (left) */}
          <div className="flex-1 min-w-0">
            <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
              <BudgetInputForm
                form={form}
                onChange={handleChange}
                syncedContributions={syncedContributions}
                isReadOnly={isReadOnly}
                saving={saving}
                onSave={handleSave}
                isCurrentMonth={selectedMonth === currentMonthStr}
                onEditThisMonth={() => setIsReadOnly(false)}
              />
            </div>
          </div>

          {/* Summary panel (right) */}
          <div className="lg:w-[340px] lg:shrink-0 space-y-[14px]">
            <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
              <BudgetSummaryPanel
                selectedMonthLabel={monthLabel(selectedMonth)}
                income={income}
                expenses={expenses}
                investments={totalInvestments}
              />
            </div>

            {/* Surplus CTA */}
            <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
              <SurplusCTA
                surplus={surplus}
                monthKey={selectedMonth.slice(0, 7)}
              />
            </div>

            {/* Goal funding gaps */}
            {totalInvestments > 0 && (
              <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                <GoalFundingGaps totalMonthlyInvestments={totalInvestments} />
              </div>
            )}
          </div>
        </div>

        {/* History chart */}
        <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <BudgetHistoryChart months={months} />
        </div>

        {/* Track B CTA */}
        <BudgetTrackBCTA surplus={surplus} />
      </div>
    </ClientAppShell>
  );
}
