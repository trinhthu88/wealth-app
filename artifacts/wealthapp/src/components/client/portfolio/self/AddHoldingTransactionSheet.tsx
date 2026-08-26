import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";
import { useHoldingTransactions, type HoldingTransactionType } from "@/hooks/useHoldingTransactions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  holdingId: string;
  isUnitsBased: boolean;
}

const TYPE_OPTIONS: { value: HoldingTransactionType; label: string }[] = [
  { value: "in", label: "Buy" },
  { value: "out", label: "Sell" },
  { value: "value_update", label: "Value update" },
  { value: "fee", label: "Fee" },
];

export default function AddHoldingTransactionSheet({ isOpen, onClose, holdingId, isUnitsBased }: Props) {
  const { addTransaction, adding } = useHoldingTransactions(holdingId);
  const [type, setType] = useState<HoldingTransactionType>("in");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [note, setNote] = useState("");

  const showUnits = isUnitsBased && (type === "in" || type === "out");

  function resetForm() {
    setType("in");
    setDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setUnits("");
    setNote("");
  }

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!(amt > 0)) return;
    await addTransaction({
      type, amount: amt, transactionDate: date,
      description: note || undefined,
      units: showUnits && units ? (parseFloat(units) || undefined) : undefined,
    });
    resetForm();
    onClose();
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Add transaction">
      <div className="space-y-4">
        <div>
          <label className="text-[12.5px] font-medium text-ink-40 mb-1 block">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full min-h-11 px-3 rounded-xl border border-hairline text-[14px] focus:outline-none focus:ring-2 focus:ring-green"
          />
        </div>

        <div>
          <label className="text-[12.5px] font-medium text-ink-40 mb-1.5 block">Type</label>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-hairline bg-paper p-1">
            {TYPE_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setType(o.value)}
                className={cn(
                  "min-h-9 rounded-lg text-[11.5px] font-semibold px-1 transition-colors",
                  type === o.value ? "bg-green text-white" : "text-ink-40 hover:text-forest",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[12.5px] font-medium text-ink-40 mb-1 block">
            {type === "value_update" ? "New value" : "Amount"}
          </label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="w-full min-h-11 px-3 rounded-xl border border-hairline text-[14px] focus:outline-none focus:ring-2 focus:ring-green"
          />
        </div>

        {showUnits && (
          <div>
            <label className="text-[12.5px] font-medium text-ink-40 mb-1 block">Units (optional)</label>
            <input
              type="number"
              min={0}
              value={units}
              onChange={e => setUnits(e.target.value)}
              placeholder="0"
              className="w-full min-h-11 px-3 rounded-xl border border-hairline text-[14px] focus:outline-none focus:ring-2 focus:ring-green"
            />
          </div>
        )}

        <div>
          <label className="text-[12.5px] font-medium text-ink-40 mb-1 block">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note"
            className="w-full min-h-11 px-3 rounded-xl border border-hairline text-[14px] focus:outline-none focus:ring-2 focus:ring-green"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={adding || !(parseFloat(amount) > 0)}
          className="w-full min-h-11 rounded-xl bg-green text-white text-[14px] font-semibold disabled:opacity-50"
        >
          {adding ? "Saving…" : "Save"}
        </button>
      </div>
    </BottomSheet>
  );
}
