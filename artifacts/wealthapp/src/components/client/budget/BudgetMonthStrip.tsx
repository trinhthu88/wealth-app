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

// 11 months back through 2 months forward — the "future" tail exists so the
// inactive/grey state has something to show.
function buildWindow(currentMonthStr: string): string[] {
  const [cy, cm] = currentMonthStr.slice(0, 7).split("-").map(Number);
  const result: string[] = [];
  for (let i = -11; i <= 2; i++) {
    const d = new Date(cy, (cm - 1) + i, 1);
    result.push(d.toISOString().slice(0, 7) + "-01");
  }
  return result;
}

function daysLeftInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

export default function BudgetMonthStrip({ selectedMonth, months, currentMonthStr, onChange }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentPillRef = useRef<HTMLButtonElement>(null);
  const window_ = buildWindow(currentMonthStr);
  const savedSet = new Set(months.map(m => m.month));

  // Center the current month on mount only — instant, not a scroll animation.
  useEffect(() => {
    currentPillRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={scrollerRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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
                "flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                isFuture
                  ? "bg-hairline text-ink-30 cursor-not-allowed"
                  : isSelected
                  ? "bg-green text-white"
                  : "bg-paper text-ink-60 hover:bg-hairline",
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
      {selectedMonth === currentMonthStr && (
        <p className="mt-1.5 text-[11px] text-ink-40">{daysLeftInMonth()} days left this month</p>
      )}
    </div>
  );
}
