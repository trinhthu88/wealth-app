import { useState } from "react";
import { cn } from "@/lib/utils";
import HoldingRow from "@/components/client/portfolio/shared/HoldingRow";
import CurrencyField from "@/components/shared/CurrencyField";
import type { AllHolding } from "@/hooks/usePortfolioTotals";

const TYPE_LABELS: Record<string, string> = {
  advised_plan: "Advised plans",
  stock_etf: "Stocks", etf: "ETFs", mutual_fund: "Mutual Funds",
  crypto: "Crypto", commodity: "Commodities", bond: "Bonds",
  property: "Property", cash: "Cash & Savings", pension: "Pension", other: "Other",
};

type SortKey = "value" | "gain" | "name";

interface Props {
  allHoldings: AllHolding[];
  displayCurrency: string;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}

export default function HoldingsTab({ allHoldings, displayCurrency, onEdit, onView }: Props) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("value");

  const presentTypes = Array.from(new Set(allHoldings.map(h => h.type)));

  const filtered = allHoldings.filter(h => filter === "all" || h.type === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "value") return b.currentValue - a.currentValue;
    if (sort === "gain") return b.gainLossPct - a.gainLossPct;
    return a.label.localeCompare(b.label);
  });

  const totalValue = filtered.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = filtered.reduce((s, h) => s + h.costBasis, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {["all", ...presentTypes].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all shrink-0",
              filter === type ? "bg-[#1D9E75] text-white border-[#1D9E75]" : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/40"
            )}
          >
            {type === "all" ? "All" : TYPE_LABELS[type] ?? type}
          </button>
        ))}
      </div>

      {/* Sort (desktop) */}
      <div className="hidden md:flex items-center gap-2 justify-end">
        <span className="text-xs text-slate-500">Sort by:</span>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-[#042C53] bg-white focus:outline-none"
        >
          <option value="value">Value ↓</option>
          <option value="gain">Gain % ↓</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-slate-400 text-sm">No {filter !== "all" ? (TYPE_LABELS[filter] ?? filter) : ""} holdings found.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Holding", "Cost basis", "Current value", "Gain / Loss", "Gain %", "CAGR", ""].map(h => (
                    <th key={h} className="text-left py-2 px-4 text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(h => (
                  <HoldingRow
                    key={h.id}
                    holding={h}
                    displayCurrency={displayCurrency}
                    onEdit={!h.isAdvisedPlan ? () => onEdit(h.id) : undefined}
                    onView={h.isAdvisedPlan ? () => onView(h.id) : undefined}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <td className="py-3 px-4 text-sm text-[#042C53]">Total</td>
                  <td className="py-3 px-4 text-sm text-slate-500"><CurrencyField amountUsd={totalCost} compact /></td>
                  <td className="py-3 px-4 text-sm text-[#042C53]"><CurrencyField amountUsd={totalValue} compact /></td>
                  <td className={cn("py-3 px-4 text-sm", totalGain >= 0 ? "text-emerald-600" : "text-red-500")}>
                    <CurrencyField amountUsd={totalGain} compact showSign />
                  </td>
                  <td className={cn("py-3 px-4 text-sm", totalGain >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {totalGain >= 0 ? "+" : ""}{totalGainPct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-4" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {sorted.map(h => (
              <HoldingRow
                key={h.id}
                holding={h}
                displayCurrency={displayCurrency}
                compact
                onEdit={!h.isAdvisedPlan ? () => onEdit(h.id) : undefined}
                onView={h.isAdvisedPlan ? () => onView(h.id) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
