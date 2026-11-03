import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  onClick: () => void;
  tint?: boolean;
  noBorder?: boolean;
}

// Leading-tile colour per row (visual only). Income rows read as Spring Field;
// spending / investment rows alternate Blue Breeze and Spring Field.
const TILE_TONES: Record<string, string> = {
  "Primary income (take-home, after tax)": "bg-field",
  "Secondary income": "bg-field",
  "Rental income": "bg-field",
  "Other income": "bg-field",
  "Housing (rent / mortgage)": "bg-breeze",
  "Food & dining": "bg-field",
  "Transport": "bg-breeze",
  "Utilities & bills": "bg-breeze",
  "Entertainment": "bg-field",
  "Other expenses": "bg-paper",
  "Insurance": "bg-breeze",
  "Shopping": "bg-field",
  "Health": "bg-breeze",
  "Education": "bg-field",
  "Other investments": "bg-breeze",
};

function initials(label: string): string {
  const words = label.replace(/\(.*?\)/g, "").split(/[\s&/,]+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function BudgetLineRow({ label, value, onClick, tint, noBorder }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-3 p-3 min-h-[64px] transition-colors hover:bg-paper/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-forest/30",
        !noBorder && "border-b border-hairline",
      )}
    >
      <span
        className={cn(
          "w-10 h-10 rounded-[14px] flex-none flex items-center justify-center text-[12px] font-semibold text-forest",
          TILE_TONES[label] ?? "bg-breeze",
        )}
        aria-hidden="true"
      >
        {initials(label)}
      </span>
      <span className="flex-1 min-w-0 text-[14px] font-medium text-forest truncate">{label}</span>
      {tint && (
        <span className="shrink-0 rounded-full bg-sun px-2 py-[3px] text-[11px] font-semibold text-forest whitespace-nowrap">
          Over 30%
        </span>
      )}
      <span className={cn("shrink-0 text-[15px] font-semibold tabular-nums", value > 0 ? "text-forest" : "text-ink-40")}>
        {value > 0 ? <>${Math.round(value).toLocaleString()}</> : "—"}
      </span>
    </button>
  );
}
