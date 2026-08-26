import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ClientBudgetMonth } from "@/hooks/useClientBudget";

interface Props {
  selectedMonth: string; // YYYY-MM-01
  months: ClientBudgetMonth[]; // months with a saved row (any order)
  currentMonthStr: string;
  onChange: (month: string) => void;
}

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildWindow(currentMonthStr: string): string[] {
  const [cy, cm] = currentMonthStr.slice(0, 7).split("-").map(Number);
  const result: string[] = [];
  for (let i = -11; i <= 2; i++) {
    const d = new Date(cy, (cm - 1) + i, 1);
    result.push(d.toISOString().slice(0, 7) + "-01");
  }
  return result;
}

export default function BudgetMonthStrip({ selectedMonth, months, currentMonthStr, onChange }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentPillRef = useRef<HTMLButtonElement>(null);
  const window_ = buildWindow(currentMonthStr);
  const savedSet = new Set(months.map(m => m.month));

  useEffect(() => {
    currentPillRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scrollerRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none mb-2">
      {window_.map(monthStr => {
        const isSelected = selectedMonth === monthStr;
        const isCurrent = monthStr === currentMonthStr;
        const isFuture = monthStr > currentMonthStr;
        const hasData = savedSet.has(monthStr);

        return (
          <button
            key={monthStr}
            ref={isCurrent ? currentPillRef : undefined}
            type="button"
            disabled={isFuture}
            onClick={() => !isFuture && onChange(monthStr)}
            aria-current={isSelected ? "date" : undefined}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors",
              isFuture
                ? "bg-hairline text-ink-30 cursor-not-allowed"
                : isSelected
                ? "bg-forest text-paper"
                : "bg-surface text-ink-40 hover:bg-hairline/50",
            )}
          >
            {formatLabel(monthStr)}
            {hasData && !isSelected && !isFuture && (
              <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
