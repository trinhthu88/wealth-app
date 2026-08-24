import { X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ClientHolding } from "@/hooks/useClientHoldings";

export interface HoldingContributionEntry {
  holdingId: string;
  amount: string;
}

interface Props {
  holdings: ClientHolding[];
  entries: HoldingContributionEntry[];
  onChange: (entries: HoldingContributionEntry[]) => void;
  isReadOnly: boolean;
}

const INVESTABLE_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond", "crypto", "property", "pension", "cash", "other"]);

export default function HoldingContributionPicker({ holdings, entries, onChange, isReadOnly }: Props) {
  const investable = holdings.filter(h => INVESTABLE_TYPES.has(h.holdingType));
  const chosenIds = new Set(entries.map(e => e.holdingId).filter(Boolean));

  function updateEntry(index: number, patch: Partial<HoldingContributionEntry>) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }
  function addEntry() {
    onChange([...entries, { holdingId: "", amount: "" }]);
  }

  const canAddMore = investable.some(h => !chosenIds.has(h.id));

  if (investable.length === 0 && entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const optionsForRow = investable.filter(h => h.id === entry.holdingId || !chosenIds.has(h.id));
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select
                value={entry.holdingId || undefined}
                onValueChange={v => updateEntry(i, { holdingId: v })}
                disabled={isReadOnly}
              >
                <SelectTrigger className="h-11 rounded-xl border-hairline bg-surface text-sm">
                  <SelectValue placeholder="Choose a holding…" />
                </SelectTrigger>
                <SelectContent>
                  {optionsForRow.map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              type="number"
              min={0}
              value={entry.amount}
              onChange={e => updateEntry(i, { amount: e.target.value })}
              placeholder="0"
              readOnly={isReadOnly}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className={cn(
                "w-28 shrink-0 min-h-11 px-3 py-2 rounded-xl border text-sm text-forest focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                isReadOnly ? "bg-paper border-hairline text-ink-30 cursor-default" : "border-hairline bg-surface"
              )}
            />
            {!isReadOnly && (
              <button
                onClick={() => removeEntry(i)}
                aria-label="Remove contribution"
                className="shrink-0 h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}

      {!isReadOnly && canAddMore && (
        <button
          onClick={addEntry}
          className="text-xs font-medium text-green hover:text-forest"
        >
          + Add contribution to a holding
        </button>
      )}
    </div>
  );
}
