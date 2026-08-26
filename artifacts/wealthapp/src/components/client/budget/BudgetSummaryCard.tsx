import { useMemo } from "react";
import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  incomeTotal: number;
  expenseTotal: number;
  investTotal: number;
  netSurplus: number;
}

export default function BudgetSummaryCard({ incomeTotal, expenseTotal, investTotal, netSurplus }: Props) {
  const isSurplus = netSurplus >= 0;
  
  // Calculate segments for the composition bar based on Income
  // If income is 0, we can fall back to relative sizes of expenses/investments
  const total = incomeTotal > 0 ? incomeTotal : Math.max(expenseTotal + investTotal, 1);
  
  const expPct = Math.min(100, Math.round((expenseTotal / total) * 100));
  const invPct = Math.min(100, Math.round((investTotal / total) * 100));
  // The rest is surplus (if positive), or 0 if deficit
  const surPct = isSurplus ? Math.max(0, 100 - expPct - invPct) : 0;
  
  return (
    <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)]">
      <div className="flex justify-between mb-4">
        <div>
          <div className="text-[13px] text-ink-40 font-semibold mb-0.5">In</div>
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums">
            <CurrencyField amountUsd={incomeTotal} />
          </div>
        </div>
        <div>
          <div className="text-[13px] text-ink-40 font-semibold mb-0.5">Out</div>
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums">
            <CurrencyField amountUsd={expenseTotal} />
          </div>
        </div>
        <div>
          <div className="text-[13px] text-green font-semibold mb-0.5">Invested</div>
          <div className="font-display text-[24px] font-semibold text-green tabular-nums">
            <CurrencyField amountUsd={investTotal} />
          </div>
        </div>
      </div>
      
      <div className="flex h-[14px] rounded-full overflow-hidden gap-[2px]">
        {/* We can hardcode 5 colors if we have 5 categories, but the prompt says 
            "In/Out/Invested summary with a composition bar". The design HTML shows 5 segments. 
            We'll use 3 main segments since we only track 3 main totals at the top level. */}
        {expPct > 0 && (
          <div style={{ flex: expPct, backgroundColor: 'var(--clay)' }} className="transition-all duration-500 ease-out" />
        )}
        {invPct > 0 && (
          <div style={{ flex: invPct, backgroundColor: 'var(--green)' }} className="transition-all duration-500 ease-out" />
        )}
        {surPct > 0 && (
          <div style={{ flex: surPct, backgroundColor: 'var(--sun)' }} className="transition-all duration-500 ease-out" />
        )}
        {expPct === 0 && invPct === 0 && surPct === 0 && (
          <div style={{ flex: 1, backgroundColor: 'var(--hairline)' }} />
        )}
      </div>
      
      <div className="text-[13px] text-ink-40 mt-3">
        {isSurplus ? (
          <>Surplus of <strong className="text-forest"><CurrencyField amountUsd={netSurplus} /></strong> sitting in your buffer account.</>
        ) : (
          <>Deficit of <strong className="text-clay"><CurrencyField amountUsd={Math.abs(netSurplus)} /></strong> this month.</>
        )}
      </div>
    </div>
  );
}
