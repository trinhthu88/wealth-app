import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import CurrencyField from "@/components/shared/CurrencyField";

interface Props {
  label: string;
  subtitle: string;
  value: number;
  color: string;
  noBorder?: boolean;
  onClick: () => void;
}

export default function BudgetCategoryRow({ label, subtitle, value, color, noBorder, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-[14px] py-[14px] transition-colors hover:bg-hairline/20",
        !noBorder && "border-b border-hairline"
      )}
    >
      <div 
        className="w-[10px] h-[34px] rounded-full flex-none" 
        style={{ backgroundColor: color }} 
      />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-forest truncate">{label}</div>
        <div className="text-[13px] text-ink-40 truncate">{subtitle}</div>
      </div>
      <div className="text-[15px] font-semibold text-forest tabular-nums">
        <CurrencyField amountUsd={value} />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-30 ml-1" aria-hidden="true" />
    </button>
  );
}
