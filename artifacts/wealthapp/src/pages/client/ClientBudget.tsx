import { useEffect, useRef, useState } from "react";
import ClientAppShell from "@/components/client/AppShell";
import BudgetMonthStrip from "@/components/client/budget/BudgetMonthStrip";
import BudgetSummaryCard from "@/components/client/budget/BudgetSummaryCard";
import BudgetLineRow from "@/components/client/budget/BudgetLineRow";
import NumericKeypadSheet from "@/components/client/budget/NumericKeypadSheet";
import InvestmentContributionRow from "@/components/client/budget/InvestmentContributionRow";
import HoldingContributionPicker, { type HoldingContributionEntry } from "@/components/client/budget/HoldingContributionPicker";
import SurplusCTA from "@/components/client/budget/SurplusCTA";
import BudgetHistoryChart from "@/components/client/budget/BudgetHistoryChart";
import BudgetTrackBCTA from "@/components/client/budget/BudgetTrackBCTA";
import {
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, n, totalOf,
  type BudgetFormState,
} from "@/components/client/budget/BudgetFieldInput";
import { useClientBudget, type InvestmentContribution } from "@/hooks/useClientBudget";
import { useClientHoldings } from "@/hooks/useClientHoldings";
import { useNetWorthItems } from "@/hooks/useNetWorthItems";
import { cn } from "@/lib/utils";

const EMPTY_FORM: BudgetFormState = {
  primaryIncome: "", secondaryIncome: "", rentalIncome: "", otherIncome: "",
  housing: "", utilities: "", transport: "", insurance: "",
  foodDining: "", entertainment: "", shopping: "", health: "", education: "", otherExpenses: "",
  otherInvestments: "",
};

const EXPENSE_KEYS = new Set(EXPENSE_CATEGORIES.map(c => c.key));
const INCOME_LABELS: Record<string, string> = Object.fromEntries(INCOME_CATEGORIES.map(c => [c.key, c.label]));
const EXPENSE_LABELS: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.key, c.label]));

function rowToForm(data: Record<string, string | null | undefined> | null): BudgetFormState {
  if (!data) return { ...EMPTY_FORM };
  const s = (v: unknown) => v != null ? String(parseFloat(String(v)) || "") : "";
  return {
    primaryIncome: s(data.primaryIncome), secondaryIncome: s(data.secondaryIncome),
    rentalIncome: s(data.rentalIncome), otherIncome: s(data.otherIncome),
    housing: s(data.housing), utilities: s(data.utilities), transport: s(data.transport), insurance: s(data.insurance),
    foodDining: s(data.foodDining), entertainment: s(data.entertainment), shopping: s(data.shopping),
    health: s(data.health), education: s(data.education), otherExpenses: s(data.otherExpenses),
    otherInvestments: "",
  };
}

function monthTitle(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long" });
}

function daysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

type ActiveField = keyof BudgetFormState | null;

export default function ClientBudget() {
  const { holdings } = useClientHoldings();
  const { manualLiabilities } = useNetWorthItems();
  const hasSyncedContributions = useRef(false);
  const skipNextHoldingSaveRef = useRef(true);
  const holdingContribSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMonthStr = new Date().toISOString().slice(0, 7) + "-01";
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const { currentMonth: monthData, months, loading, saveMonth, syncInvestmentContributions } = useClientBudget(selectedMonth);

  const [form, setForm] = useState<BudgetFormState>({ ...EMPTY_FORM });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [holdingContributions, setHoldingContributions] = useState<HoldingContributionEntry[]>([]);
  const [activeField, setActiveField] = useState<ActiveField>(null);

  useEffect(() => {
    if (!loading) {
      setForm(rowToForm(monthData as any));
      const selfHolding = ((monthData?.investmentContributions ?? []) as InvestmentContribution[])
        .filter(c => c.source_type === "self_holding")
        .map(c => ({ holdingId: c.source_id, amount: String(c.amount) }));
      setHoldingContributions(selfHolding);
      // The next holdingContributions-change effect run is this same load,
      // not a user edit — skip it so we don't immediately re-save on mount.
      skipNextHoldingSaveRef.current = true;
    }
  }, [monthData?.id, loading]);

  useEffect(() => {
    const isPast = selectedMonth !== currentMonthStr;
    setIsReadOnly(isPast && !!monthData);
  }, [selectedMonth, currentMonthStr, monthData?.id]);

  useEffect(() => {
    if (hasSyncedContributions.current) return;
    hasSyncedContributions.current = true;
    syncInvestmentContributions().catch(() => {});
  }, [syncInvestmentContributions]);

  function handleChange(field: keyof BudgetFormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const advisedPlanContributions = ((monthData?.investmentContributions ?? []) as InvestmentContribution[])
    .filter(c => c.source_type === "advised_plan");
  const holdingsById = Object.fromEntries(holdings.map(h => [h.id, h]));

  // Auto-synced, read-only: the sum of "Monthly repayment" set on each
  // liability (Net Worth page), counted as an expense here — not one of the
  // user-editable EXPENSE_CATEGORIES.
  const debtPaymentsTotal = manualLiabilities.reduce((s, l) => s + (l.monthlyPaymentUsd ?? 0), 0);

  const incomeTotal = totalOf(form, INCOME_CATEGORIES);
  const expenseTotal = totalOf(form, EXPENSE_CATEGORIES) + debtPaymentsTotal;
  const advisedInvest = advisedPlanContributions.reduce((s, c) => s + c.amount, 0);
  const holdingInvest = holdingContributions.reduce((s, e) => s + n(e.amount), 0);
  const investTotal = advisedInvest + holdingInvest + n(form.otherInvestments);

  // Prefer the saved month's own totals/surplus when viewing a saved month
  // (read-only past months show what was actually saved); fall back to live
  // form totals — recalculated on every keystroke — for the editable month.
  const netSurplus = monthData && isReadOnly ? parseFloat(monthData.netSurplus ?? "0") || 0 : incomeTotal - expenseTotal - investTotal;
  const expensesOverThreshold = incomeTotal > 0 && expenseTotal > incomeTotal * 0.7;

  async function persist() {
    const all: InvestmentContribution[] = [
      ...advisedPlanContributions,
      ...holdingContributions
        .filter(e => e.holdingId && n(e.amount) > 0)
        .map(e => ({
          label: holdingsById[e.holdingId]?.label ?? "Holding",
          amount: n(e.amount),
          source_id: e.holdingId,
          source_type: "self_holding",
        })),
      ...(n(form.otherInvestments) > 0 ? [{
        label: "Other investments", amount: n(form.otherInvestments), source_id: "manual", source_type: "manual",
      }] : []),
    ];

    try {
      await saveMonth({
        month: selectedMonth,
        currency: "USD",
        primaryIncome: form.primaryIncome || "0", secondaryIncome: form.secondaryIncome || "0",
        rentalIncome: form.rentalIncome || "0", otherIncome: form.otherIncome || "0",
        housing: form.housing || "0", utilities: form.utilities || "0",
        transport: form.transport || "0", insurance: form.insurance || "0",
        foodDining: form.foodDining || "0", entertainment: form.entertainment || "0",
        shopping: form.shopping || "0", health: form.health || "0",
        education: form.education || "0", otherExpenses: form.otherExpenses || "0",
        debtPayments: String(debtPaymentsTotal),
        investmentContributions: all,
      } as any);
    } catch {
      // mutation's onError already shows a toast
    }
  }

  function closeKeypad() {
    setActiveField(null);
  }

  async function handleKeypadDone() {
    setActiveField(null);
    if (!isReadOnly) await persist();
  }

  // Holding-contribution rows aren't driven through the keypad's own Done
  // button, so debounce-save whenever one changes instead.
  useEffect(() => {
    if (skipNextHoldingSaveRef.current) {
      skipNextHoldingSaveRef.current = false;
      return;
    }
    if (isReadOnly) return;
    if (holdingContribSaveTimer.current) clearTimeout(holdingContribSaveTimer.current);
    holdingContribSaveTimer.current = setTimeout(() => { persist(); }, 900);
    return () => {
      if (holdingContribSaveTimer.current) clearTimeout(holdingContribSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingContributions, isReadOnly]);

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
  }

  if (loading) {
    return (
      <ClientAppShell>
        <div className="space-y-[14px]">
          <div className="h-24 bg-surface animate-pulse rounded-[22px]" />
          <div className="h-20 bg-surface animate-pulse rounded-[22px]" />
          <div className="h-20 bg-surface animate-pulse rounded-[20px]" />
        </div>
      </ClientAppShell>
    );
  }

  const activeIsIncome = activeField != null && activeField in INCOME_LABELS;
  const activeIsExpense = activeField != null && EXPENSE_KEYS.has(activeField as any);
  const activeLabel = activeField
    ? (INCOME_LABELS[activeField] ?? EXPENSE_LABELS[activeField] ?? "Other investments")
    : "";
  const activeHint = activeIsIncome
    ? `This month's expected ${activeLabel.toLowerCase()}`
    : activeIsExpense
    ? "Estimated monthly spend"
    : "This month's other investment contributions";

  return (
    <ClientAppShell>
      <div className="space-y-[14px] pb-12">
        <div className="mb-2">
          <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em]">
            {monthTitle(selectedMonth)}
          </h1>
          {selectedMonth === currentMonthStr && (
            <div className="text-[14px] text-ink-40 mt-1">
              {daysLeftInMonth()} days left in the month
            </div>
          )}
        </div>

        <BudgetMonthStrip
          selectedMonth={selectedMonth}
          months={months}
          currentMonthStr={currentMonthStr}
          onChange={handleMonthChange}
        />

        <BudgetSummaryCard
          incomeTotal={incomeTotal}
          expenseTotal={expenseTotal}
          investTotal={investTotal}
          netSurplus={netSurplus}
        />

        <SurplusCTA surplus={netSurplus} monthKey={selectedMonth.slice(0, 7)} />

        {isReadOnly && (
          <div className="flex items-center justify-between bg-paper border border-hairline rounded-xl px-4 py-2.5">
            <p className="text-sm text-ink-40">Viewing past month — read only</p>
            <button onClick={() => setIsReadOnly(false)} className="text-sm text-green font-semibold hover:text-forest">
              Edit this month
            </button>
          </div>
        )}

        {/* Income */}
        <div className="bg-surface rounded-[26px] p-[16px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[15px] font-semibold text-forest">Income</p>
            <span className="text-[14px] font-semibold text-forest tabular-nums">${Math.round(incomeTotal).toLocaleString()}</span>
          </div>
          {INCOME_CATEGORIES.map((cat, i) => (
            <BudgetLineRow
              key={cat.key}
              label={cat.label}
              value={n(form[cat.key])}
              noBorder={i === INCOME_CATEGORIES.length - 1}
              onClick={() => !isReadOnly && setActiveField(cat.key)}
            />
          ))}
        </div>

        {/* Expenses */}
        <div className="bg-surface rounded-[26px] p-[16px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[15px] font-semibold text-forest">Expenses</p>
            <span className={cn("text-[14px] font-semibold tabular-nums", expensesOverThreshold ? "text-clay" : "text-forest")}>
              ${Math.round(expenseTotal).toLocaleString()}
            </span>
          </div>
          {EXPENSE_CATEGORIES.map(cat => {
            const val = n(form[cat.key]);
            const overThirty = incomeTotal > 0 && val > incomeTotal * 0.3;
            return (
              <BudgetLineRow
                key={cat.key}
                label={cat.label}
                value={val}
                tint={overThirty}
                onClick={() => !isReadOnly && setActiveField(cat.key)}
              />
            );
          })}

          {debtPaymentsTotal > 0 && (
            <div className="pt-3">
              <InvestmentContributionRow
                tone="clay"
                contribution={{ label: "Debt payments", amount: debtPaymentsTotal, source_id: "liabilities", source_type: "liabilities" }}
                hint="Synced from your liabilities' monthly repayments — edit these on the Net Worth page."
              />
            </div>
          )}
        </div>

        {/* Investments */}
        <div className="bg-surface rounded-[26px] p-[16px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)] space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-forest">Investments</p>
            <span className="text-[14px] font-semibold text-green tabular-nums">${Math.round(investTotal).toLocaleString()}</span>
          </div>
          <p className="text-xs text-ink-30">Fixed monthly amounts going into your investments.</p>
          {advisedPlanContributions.map(c => (
            <InvestmentContributionRow key={c.source_id} contribution={c} />
          ))}
          <HoldingContributionPicker
            holdings={holdings}
            entries={holdingContributions}
            onChange={setHoldingContributions}
            isReadOnly={isReadOnly}
          />
          <BudgetLineRow
            label="Other investments"
            value={n(form.otherInvestments)}
            noBorder
            onClick={() => !isReadOnly && setActiveField("otherInvestments")}
          />
        </div>

        <div className="bg-surface rounded-[26px] p-[18px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <BudgetHistoryChart months={months} />
        </div>

        <BudgetTrackBCTA surplus={netSurplus} />
      </div>

      <NumericKeypadSheet
        isOpen={activeField !== null}
        onClose={closeKeypad}
        title={activeLabel}
        hint={activeHint}
        value={activeField ? form[activeField] : ""}
        onChange={v => activeField && handleChange(activeField, v)}
        onDone={handleKeypadDone}
      />
    </ClientAppShell>
  );
}
