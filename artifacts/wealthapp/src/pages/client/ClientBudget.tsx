import { useEffect, useRef, useState } from "react";
import ClientAppShell from "@/components/client/AppShell";
import BottomSheet from "@/components/client/BottomSheet";
import BudgetMonthStrip from "@/components/client/budget/BudgetMonthStrip";
import BudgetSurplusBar from "@/components/client/budget/BudgetSurplusBar";
import BudgetCategoryCard from "@/components/client/budget/BudgetCategoryCard";
import InvestmentContributionRow from "@/components/client/budget/InvestmentContributionRow";
import HoldingContributionPicker, { type HoldingContributionEntry } from "@/components/client/budget/HoldingContributionPicker";
import SurplusCTA from "@/components/client/budget/SurplusCTA";
import GoalFundingGaps from "@/components/client/budget/GoalFundingGaps";
import BudgetHistoryChart from "@/components/client/budget/BudgetHistoryChart";
import BudgetTrackBCTA from "@/components/client/budget/BudgetTrackBCTA";
import {
  NumberInput, INCOME_CATEGORIES, EXPENSE_CATEGORIES, n, totalOf,
  type BudgetFormState,
} from "@/components/client/budget/BudgetFieldInput";
import { useClientBudget, type InvestmentContribution } from "@/hooks/useClientBudget";
import { useClientHoldings } from "@/hooks/useClientHoldings";

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
    primaryIncome: s(data.primaryIncome), secondaryIncome: s(data.secondaryIncome),
    rentalIncome: s(data.rentalIncome), otherIncome: s(data.otherIncome),
    housing: s(data.housing), utilities: s(data.utilities), transport: s(data.transport), insurance: s(data.insurance),
    foodDining: s(data.foodDining), entertainment: s(data.entertainment), shopping: s(data.shopping),
    health: s(data.health), education: s(data.education), otherExpenses: s(data.otherExpenses),
    otherInvestments: "",
  };
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type SheetKey = "income" | "expenses" | "investments" | null;

export default function ClientBudget() {
  const { holdings } = useClientHoldings();
  const hasSyncedContributions = useRef(false);

  const currentMonthStr = new Date().toISOString().slice(0, 7) + "-01";
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const { currentMonth: monthData, months, loading, saving, saveMonth, syncInvestmentContributions } = useClientBudget(selectedMonth);

  const [form, setForm] = useState<BudgetFormState>({ ...EMPTY_FORM });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [holdingContributions, setHoldingContributions] = useState<HoldingContributionEntry[]>([]);
  const [openSheet, setOpenSheet] = useState<SheetKey>(null);

  useEffect(() => {
    if (!loading) {
      setForm(rowToForm(monthData as any));
      const selfHolding = ((monthData?.investmentContributions ?? []) as InvestmentContribution[])
        .filter(c => c.source_type === "self_holding")
        .map(c => ({ holdingId: c.source_id, amount: String(c.amount) }));
      setHoldingContributions(selfHolding);
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

  const incomeTotal = totalOf(form, INCOME_CATEGORIES);
  const expenseTotal = totalOf(form, EXPENSE_CATEGORIES);
  const advisedInvest = advisedPlanContributions.reduce((s, c) => s + c.amount, 0);
  const holdingInvest = holdingContributions.reduce((s, e) => s + n(e.amount), 0);
  const investTotal = advisedInvest + holdingInvest + n(form.otherInvestments);

  // Prefer the saved month's own totals/surplus when viewing a saved month
  // (read-only past months show what was actually saved); fall back to live
  // form totals for the current, still-editable month.
  const netSurplus = monthData ? parseFloat(monthData.netSurplus ?? "0") || 0 : incomeTotal - expenseTotal - investTotal;
  const savingsRatePct = monthData ? parseFloat(monthData.savingsRatePct ?? "0") || 0
    : (incomeTotal > 0 ? ((incomeTotal - expenseTotal - investTotal) / incomeTotal) * 100 : 0);

  async function handleSave() {
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
        investmentContributions: all,
      } as any);
      setOpenSheet(null);
    } catch {
      // mutation's onError already shows a toast
    }
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

  return (
    <ClientAppShell>
      <div className="space-y-[14px] pb-12">
        <div className="mb-1">
          <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em]">
            {monthLabel(selectedMonth)}
          </h1>
        </div>

        <BudgetMonthStrip
          selectedMonth={selectedMonth}
          months={months}
          currentMonthStr={currentMonthStr}
          onChange={handleMonthChange}
        />

        <BudgetSurplusBar netSurplus={netSurplus} savingsRatePct={savingsRatePct} />

        <div className="space-y-3">
          <BudgetCategoryCard
            label="Income"
            total={incomeTotal}
            pctOfIncome={100}
            borderColor="var(--green)"
            onClick={() => setOpenSheet("income")}
          />
          <BudgetCategoryCard
            label="Expenses"
            total={expenseTotal}
            pctOfIncome={incomeTotal > 0 ? (expenseTotal / incomeTotal) * 100 : 0}
            borderColor="#EF4444"
            onClick={() => setOpenSheet("expenses")}
          />
          <BudgetCategoryCard
            label="Investments"
            total={investTotal}
            pctOfIncome={incomeTotal > 0 ? (investTotal / incomeTotal) * 100 : 0}
            borderColor="var(--violet)"
            onClick={() => setOpenSheet("investments")}
          />
        </div>

        <SurplusCTA surplus={netSurplus} monthKey={selectedMonth.slice(0, 7)} />

        {investTotal > 0 && (
          <div className="bg-surface rounded-[22px] p-[18px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
            <GoalFundingGaps totalMonthlyInvestments={investTotal} />
          </div>
        )}

        <div className="bg-surface rounded-[22px] p-[18px_20px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
          <BudgetHistoryChart months={months} />
        </div>

        <BudgetTrackBCTA surplus={netSurplus} />
      </div>

      {/* Income sheet */}
      <BottomSheet isOpen={openSheet === "income"} onClose={() => setOpenSheet(null)} title="Income">
        <div className="space-y-4">
          {isReadOnly && (
            <div className="flex items-center justify-between bg-paper border border-hairline rounded-xl px-4 py-2.5">
              <p className="text-sm text-ink-40">Viewing past month — read only</p>
              <button onClick={() => setIsReadOnly(false)} className="text-sm text-green font-semibold hover:text-forest">
                Edit this month
              </button>
            </div>
          )}
          {INCOME_CATEGORIES.map(cat => (
            <NumberInput
              key={cat.key}
              label={<>{cat.icon}{cat.label}</>}
              value={form[cat.key]}
              onChange={v => handleChange(cat.key, v)}
              placeholder={"placeholder" in cat ? cat.placeholder : undefined}
              readOnly={isReadOnly}
            />
          ))}
          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full min-h-11 py-3 rounded-xl bg-forest text-paper font-semibold text-sm hover:bg-forest-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Expenses sheet */}
      <BottomSheet isOpen={openSheet === "expenses"} onClose={() => setOpenSheet(null)} title="Expenses">
        <div className="space-y-4">
          {isReadOnly && (
            <div className="flex items-center justify-between bg-paper border border-hairline rounded-xl px-4 py-2.5">
              <p className="text-sm text-ink-40">Viewing past month — read only</p>
              <button onClick={() => setIsReadOnly(false)} className="text-sm text-green font-semibold hover:text-forest">
                Edit this month
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXPENSE_CATEGORIES.map(cat => (
              <NumberInput
                key={cat.key}
                label={<>{cat.icon}{cat.label}</>}
                value={form[cat.key]}
                onChange={v => handleChange(cat.key, v)}
                readOnly={isReadOnly}
              />
            ))}
          </div>
          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full min-h-11 py-3 rounded-xl bg-forest text-paper font-semibold text-sm hover:bg-forest-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Investments sheet */}
      <BottomSheet isOpen={openSheet === "investments"} onClose={() => setOpenSheet(null)} title="Investments">
        <div className="space-y-4">
          {isReadOnly && (
            <div className="flex items-center justify-between bg-paper border border-hairline rounded-xl px-4 py-2.5">
              <p className="text-sm text-ink-40">Viewing past month — read only</p>
              <button onClick={() => setIsReadOnly(false)} className="text-sm text-green font-semibold hover:text-forest">
                Edit this month
              </button>
            </div>
          )}
          <p className="text-xs text-ink-30">Fixed monthly amounts going into your investments.</p>
          <div className="space-y-3">
            {advisedPlanContributions.map(c => (
              <InvestmentContributionRow key={c.source_id} contribution={c} />
            ))}
            <HoldingContributionPicker
              holdings={holdings}
              entries={holdingContributions}
              onChange={setHoldingContributions}
              isReadOnly={isReadOnly}
            />
            <NumberInput
              label="Unattributed / other contributions"
              value={form.otherInvestments}
              onChange={v => handleChange("otherInvestments", v)}
              placeholder="e.g. brokerage top-ups, crypto buys"
              readOnly={isReadOnly}
            />
          </div>
          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full min-h-11 py-3 rounded-xl bg-forest text-paper font-semibold text-sm hover:bg-forest-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </BottomSheet>
    </ClientAppShell>
  );
}
