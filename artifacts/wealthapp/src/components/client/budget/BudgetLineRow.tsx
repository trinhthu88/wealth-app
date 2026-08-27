import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  onClick: () => void;
  tint?: boolean;
  noBorder?: boolean;
}

export default function BudgetLineRow({ label, value, onClick, tint, noBorder }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center justify-between gap-3 py-3 px-3 -mx-3 rounded-lg transition-colors",
        !noBorder && "border-b border-hairline",
        tint ? "bg-clay-tint" : "hover:bg-hairline/20"
      )}
    >
      <span className="text-[14px] font-medium text-forest truncate">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className={cn("text-[14px] font-semibold tabular-nums", value > 0 ? "text-green" : "text-ink-30")}>
          {value > 0 ? <>${Math.round(value).toLocaleString()}</> : "—"}
        </span>
        <ChevronRight className="h-4 w-4 text-ink-30" aria-hidden="true" />
      </span>
    </button>
  );
}
