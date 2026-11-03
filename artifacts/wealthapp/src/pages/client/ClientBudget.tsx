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
          <div className="h-24 bg-surface animate-pulse rounded-[24px]" />
          <div className="h-40 bg-surface animate-pulse rounded-[28px]" />
          <div className="h-20 bg-surface animate-pulse rounded-[24px]" />
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

  // Split bar: share of income spent / invested / kept (visual only).
  const pctOfIncome = (v: number) =>
    incomeTotal > 0 ? Math.max(0, Math.min(100, (v / incomeTotal) * 100)) : 0;
  const spentW = pctOfIncome(expenseTotal);
  const investW = Math.min(100 - spentW, pctOfIncome(investTotal));
  const keptW = Math.min(100 - spentW - investW, pctOfIncome(Math.max(0, netSurplus)));
  const fmtWhole = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const splitLabel = `Of ${fmtWhole(incomeTotal)} income: ${fmtWhole(expenseTotal)} spent, ${fmtWhole(investTotal)} invested, ${fmtWhole(netSurplus)} kept`;

  return (
    <ClientAppShell>
      <div className="space-y-[14px] pb-12">
        <div className="px-1 pt-1">
          <h1 className="font-display text-[34px] leading-[1.05] text-forest">
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

        {isReadOnly && (
          <div className="flex items-center justify-between gap-2 bg-surface rounded-[16px] py-1 pr-1 pl-3.5">
            <p className="text-[13px] text-ink-40">Viewing past month — read only</p>
            <button
              onClick={() => setIsReadOnly(false)}
              className="h-10 px-3.5 rounded-full text-[13px] font-semibold text-forest underline underline-offset-2 hover:text-forest-700"
            >
              Edit this month
            </button>
          </div>
        )}

        <section aria-label={`Kept this ${monthTitle(selectedMonth)}`} className="bg-forest rounded-[28px] p-5 flex flex-col gap-3.5">
          <p className="tala-eyebrow text-mint">Kept this {monthTitle(selectedMonth)}</p>
          <div className="flex items-end justify-between gap-2">
            <span className="font-display tabular-nums text-[56px] leading-[0.9] tracking-[-0.04em] text-paper min-w-0 truncate">
              <CurrencyField amountUsd={netSurplus} compact showSign={netSurplus < 0} />
            </span>
            {incomeTotal > 0 && (
              <span className="shrink-0 rounded-full bg-field px-[11px] py-1.5 text-[12px] font-semibold text-forest whitespace-nowrap">
                {savingsRatePct}% savings rate
              </span>
            )}
          </div>
          <div
            role="img"
            aria-label={splitLabel}
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/10"
          >
            {spentW > 0 && <span className="h-full bg-sun" style={{ width: `${spentW}%` }} />}
            {investW > 0 && <span className="h-full bg-field" style={{ width: `${investW}%` }} />}
            {keptW > 0 && <span className="h-full bg-breeze" style={{ width: `${keptW}%` }} />}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-[3px]">
              <div className="text-[12px] text-mint">Income</div>
              <div className="text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={incomeTotal} compact /></div>
            </div>
            <div className="flex flex-col gap-[3px]">
              <div className="flex items-center gap-[5px] text-[12px] text-mint">
                <span className="h-2 w-2 rounded-[2px] bg-sun" aria-hidden="true" />Spent
              </div>
              <div className="text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={expenseTotal} compact /></div>
            </div>
            <div className="flex flex-col gap-[3px]">
              <div className="flex items-center gap-[5px] text-[12px] text-mint">
                <span className="h-2 w-2 rounded-[2px] bg-field" aria-hidden="true" />Invested
              </div>
              <div className="text-[16px] font-semibold text-paper tabular-nums"><CurrencyField amountUsd={investTotal} compact /></div>
            </div>
          </div>
        </section>

        {incomeTotal > 0 && biggestExpense && biggestExpense.value > 0 && (
          <div className="bg-breeze rounded-[24px] p-4">
            <SolNarration
              className="mb-0"
              line={`You kept ${savingsRatePct}% of income ${monthTitle(selectedMonth)}. ${biggestExpense.label} is your biggest category at $${Math.round(biggestExpense.value).toLocaleString()}.`}
              detail="A savings rate near 20-30% is strong by most standards. Small month-to-month drift in one category matters far less than the rate holding steady over time."
              advisorFirstName={advisorFirstName}
            />
          </div>
        )}

        <SurplusCTA surplus={netSurplus} monthKey={selectedMonth.slice(0, 7)} />

        {/* Income */}
        <section aria-label="Income" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1 pt-1.5">
            <h2 className="text-[16px] font-semibold text-forest">Income</h2>
            <span className="text-[15px] font-semibold text-forest tabular-nums">${Math.round(incomeTotal).toLocaleString()}</span>
          </div>
          <div className="bg-surface rounded-[24px] p-1 flex flex-col overflow-hidden">
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
        </section>

        {/* Expenses */}
        <section aria-label="Expenses" className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 px-1 pt-1.5">
            <h2 className="text-[16px] font-semibold text-forest">Expenses</h2>
            <span className="flex items-center gap-2">
              {expensesOverThreshold && (
                <span className="rounded-full bg-sun px-2 py-[3px] text-[11px] font-semibold text-forest whitespace-nowrap">
                  Over 70% of income
                </span>
              )}
              <span className="text-[15px] font-semibold text-forest tabular-nums">
                ${Math.round(expenseTotal).toLocaleString()}
              </span>
            </span>
          </div>
          <div className="bg-surface rounded-[24px] p-1 flex flex-col overflow-hidden">
            {visibleExpenseCategories.map((cat, i) => {
              const val = n(form[cat.key]);
              const overThirty = incomeTotal > 0 && val > incomeTotal * 0.3;
              return (
                <BudgetLineRow
                  key={cat.key}
                  label={cat.label}
                  value={val}
                  tint={overThirty}
                  noBorder={debtPaymentsTotal <= 0 && i === visibleExpenseCategories.length - 1}
                  onClick={() => !isReadOnly && setActiveField(cat.key)}
                />
              );
            })}

            {debtPaymentsTotal > 0 && (
              <InvestmentContributionRow
                tone="clay"
                contribution={{ label: "Debt payments", amount: debtPaymentsTotal, source_id: "liabilities", source_type: "liabilities" }}
                hint="Synced from your liabilities' monthly repayments — edit these on the Net Worth page."
              />
            )}
          </div>
        </section>

        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails(value => !value)}
          className="w-full h-11 rounded-full border-[1.5px] border-forest bg-transparent text-[14px] font-semibold text-forest hover:bg-surface transition-colors"
        >
          {showDetails ? "Hide details" : "Add detail"}
        </button>

        {/* Investments */}
        <section aria-label="Investments" className="space-y-2.5">
          <div className="px-1 pt-1.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[16px] font-semibold text-forest">Investments</h2>
              <span className="text-[15px] font-semibold text-forest tabular-nums">${Math.round(investTotal).toLocaleString()}</span>
            </div>
            <p className="text-[13px] text-ink-40 mt-0.5">Fixed monthly amounts going into your investments.</p>
          </div>
          <div className="bg-surface rounded-[24px] p-1 flex flex-col overflow-hidden">
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
        </section>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => { void persist(); }}
            disabled={!hasUnsavedChanges || saving}
            className="w-full h-12 rounded-full bg-forest px-5 text-[15px] font-semibold text-paper hover:bg-forest-700 transition-colors disabled:bg-surface disabled:text-ink-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : hasUnsavedChanges ? "Save budget" : monthData ? "Budget saved" : "No changes to save"}
          </button>
        )}

        <div className="bg-surface rounded-[24px] p-5">
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
