import { useEffect, useRef, useState } from "react";
import ClientAppShell from "@/components/client/AppShell";
import SolNarration from "@/components/client/SolNarration";
import CurrencyField from "@/components/shared/CurrencyField";
import BudgetMonthStrip from "@/components/client/budget/BudgetMonthStrip";
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
import { usePlan } from "@/hooks/usePlan";
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
const QUICK_EXPENSE_ORDER = ["housing", "foodDining", "transport", "utilities", "entertainment", "otherExpenses"] as const;
const DETAIL_FIELD_KEYS = ["secondaryIncome", "rentalIncome", "otherIncome", "insurance", "shopping", "health", "education"] as const;

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

function hasDetailedBudgetValues(data: Record<string, unknown> | null): boolean {
  return !!data && DETAIL_FIELD_KEYS.some(key => (parseFloat(String(data[key] ?? "0")) || 0) !== 0);
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
  const { advisorName } = usePlan();
  const hasSyncedContributions = useRef(false);
  const editVersionRef = useRef(0);

  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-01`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const { currentMonth: monthData, months, loading, saving, saveMonth, syncInvestmentContributions } = useClientBudget(selectedMonth);
  const previousMonthData = months
    .filter(month => month.month.slice(0, 7) < selectedMonth.slice(0, 7))
    .at(-1) ?? null;
  const formSource = monthData ?? previousMonthData;

  const [form, setForm] = useState<BudgetFormState>({ ...EMPTY_FORM });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [holdingContributions, setHoldingContributions] = useState<HoldingContributionEntry[]>([]);
  const [activeField, setActiveField] = useState<ActiveField>(null);

  useEffect(() => {
    if (!loading) {
      setForm(rowToForm(formSource as any));
      setShowDetails(hasDetailedBudgetValues(formSource as any));
      setHasUnsavedChanges(!monthData && !!previousMonthData);
      const selfHolding = ((monthData?.investmentContributions ?? []) as InvestmentContribution[])
        .filter(c => c.source_type === "self_holding")
        .map(c => ({ holdingId: c.source_id, amount: String(c.amount) }));
      setHoldingContributions(selfHolding);
    }
  }, [formSource?.id, formSource?.updatedAt, monthData?.id, loading, selectedMonth]);

  useEffect(() => {
    const isPast = selectedMonth !== currentMonthStr;
    setIsReadOnly(isPast && !!monthData);
  }, [selectedMonth, currentMonthStr, monthData?.id]);

  useEffect(() => {
    if (loading || !monthData || selectedMonth !== currentMonthStr) return;
    if (hasSyncedContributions.current) return;
    hasSyncedContributions.current = true;
    syncInvestmentContributions().catch(() => {});
  }, [loading, monthData?.id, selectedMonth, currentMonthStr, syncInvestmentContributions]);

  function handleChange(field: keyof BudgetFormState, value: string) {
    editVersionRef.current += 1;
    setHasUnsavedChanges(true);
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleHoldingContributionsChange(entries: HoldingContributionEntry[]) {
    editVersionRef.current += 1;
    setHasUnsavedChanges(true);
    setHoldingContributions(entries);
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
    const editVersionAtSave = editVersionRef.current;
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
      if (editVersionRef.current === editVersionAtSave) setHasUnsavedChanges(false);
    } catch {
      // mutation's onError already shows a toast
    }
  }

  function closeKeypad() {
    setActiveField(null);
  }

  async function handleKeypadDone() {
    setActiveField(null);
  }

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

  const savingsRatePct = incomeTotal > 0 ? Math.round((netSurplus / incomeTotal) * 100) : 0;
  const biggestExpense = EXPENSE_CATEGORIES
    .map(cat => ({ label: cat.label, value: n(form[cat.key]) }))
    .sort((a, b) => b.value - a.value)[0];
  const advisorFirstName = advisorName?.split(" ")[0] ?? null;
  const visibleIncomeCategories = showDetails
    ? INCOME_CATEGORIES
    : INCOME_CATEGORIES.filter(cat => cat.key === "primaryIncome");
  const visibleExpenseCategories = showDetails
    ? EXPENSE_CATEGORIES
    : QUICK_EXPENSE_ORDER.map(key => EXPENSE_CATEGORIES.find(cat => cat.key === key)!);

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

        {incomeTotal > 0 && biggestExpense && biggestExpense.value > 0 && (
          <SolNarration
            line={`You kept ${savingsRatePct}% of income ${monthTitle(selectedMonth)}. ${biggestExpense.label} is your biggest category at $${Math.round(biggestExpense.value).toLocaleString()}.`}
            detail="A savings rate near 20-30% is strong by most standards. Small month-to-month drift in one category matters far less than the rate holding steady over time."
            advisorFirstName={advisorFirstName}
          />
        )}

        <div className="bg-forest rounded-[26px] p-[22px]">
          <p className="text-[12.5px] font-semibold text-mint">Kept this {monthTitle(selectedMonth)}</p>
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[40px] font-semibold text-paper tracking-[-0.03em] tabular-nums">
              <CurrencyField amountUsd={netSurplus} compact showSign={netSurplus < 0} />
            </span>
            {incomeTotal > 0 && (
              <span className="text-[14px] font-semibold text-sun">{savingsRatePct}% rate</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            <div>
              <div className="text-[11.5px] text-mint">Income</div>
              <div className="text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={incomeTotal} compact /></div>
            </div>
            <div>
              <div className="text-[11.5px] text-mint">Spent</div>
              <div className="text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={expenseTotal} compact /></div>
            </div>
            <div>
              <div className="text-[11.5px] text-mint">Invested</div>
              <div className="text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={investTotal} compact /></div>
            </div>
          </div>
        </div>

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
          {visibleIncomeCategories.map((cat, i) => (
            <BudgetLineRow
              key={cat.key}
              label={cat.label}
              value={n(form[cat.key])}
              noBorder={i === visibleIncomeCategories.length - 1}
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
          {visibleExpenseCategories.map(cat => {
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

        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails(value => !value)}
          className="w-full bg-paper border border-hairline rounded-full py-3 text-[14px] font-semibold text-green hover:text-forest transition-colors"
        >
          {showDetails ? "Hide details" : "Add detail"}
        </button>

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
            onChange={handleHoldingContributionsChange}
            isReadOnly={isReadOnly}
          />
          <BudgetLineRow
            label="Other investments"
            value={n(form.otherInvestments)}
            noBorder
            onClick={() => !isReadOnly && setActiveField("otherInvestments")}
          />
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => { void persist(); }}
            disabled={!hasUnsavedChanges || saving}
            className="w-full rounded-full bg-green px-5 py-3.5 text-[15px] font-semibold text-paper disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : hasUnsavedChanges ? "Save budget" : monthData ? "Budget saved" : "No changes to save"}
          </button>
        )}

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
