import { cn } from "@/lib/utils";
import type { ClientBudgetMonth } from "@/hooks/useClientBudget";

interface Props {
  selectedMonth: string; // YYYY-MM-DD
  months: ClientBudgetMonth[];
  onChange: (month: string) => void;
}

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function generate12Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(d.toISOString().slice(0, 7) + "-01");
  }
  return result; // DESC order (current first)
}

export default function BudgetMonthSelector({ selectedMonth, months, onChange }: Props) {
  const allMonths = generate12Months();
  const savedSet = new Set(months.map(m => m.month));

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {allMonths.map(monthStr => {
        const isSelected = selectedMonth === monthStr;
        const hasSaved = savedSet.has(monthStr);
        const isCurrent = monthStr === allMonths[0];

        return (
          <button
            key={monthStr}
            onClick={() => onChange(monthStr)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              isSelected
                ? "bg-[#1D9E75] text-white"
                : hasSaved
                ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            )}
          >
            {formatLabel(monthStr)}
            {hasSaved && !isSelected && (
              <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
            )}
            {isCurrent && !hasSaved && !isSelected && (
              <span className="text-[10px] text-slate-300">–</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
