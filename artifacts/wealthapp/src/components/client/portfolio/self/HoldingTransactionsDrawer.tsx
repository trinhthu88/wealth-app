import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";
import { useHoldingTransactions, type HoldingTransactionType } from "@/hooks/useHoldingTransactions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  holdingId: string;
  holdingLabel: string;
  isUnitsBased: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual entry",
  budget_contribution: "Budget contribution",
  surplus_sweep: "Surplus auto-sweep",
};

const TYPE_OPTIONS: { value: HoldingTransactionType; label: string }[] = [
  { value: "in", label: "Buy more" },
  { value: "out", label: "Partial sell" },
  { value: "value_update", label: "Value update" },
  { value: "fee", label: "Fee paid" },
];

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtUsd(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function signFor(type: HoldingTransactionType) {
  if (type === "in") return 1;
  if (type === "out" || type === "fee") return -1;
  return 0; // value_update doesn't carry a direction
}

export default function HoldingTransactionsDrawer({ isOpen, onClose, holdingId, holdingLabel, isUnitsBased }: Props) {
  const { transactions, loading, addTransaction, deleteTransaction, adding } = useHoldingTransactions(isOpen ? holdingId : null);
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState<HoldingTransactionType>("in");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [note, setNote] = useState("");

  function resetForm() {
    setType("in");
    setDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setUnits("");
    setNote("");
  }

  async function handleAdd() {
    const amt = parseFloat(amount);
    if (!(amt > 0)) return;
    await addTransaction({
      type, amount: amt, transactionDate: date,
      description: note || undefined,
      units: units ? parseFloat(units) || undefined : undefined,
    });
    resetForm();
    setAddOpen(false);
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`${holdingLabel} — Transactions`}>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-12 bg-hairline/60 animate-pulse rounded-lg" />)}
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-[13.5px] text-ink-40 py-6 text-center">No transactions yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {transactions.map(tx => {
            const amt = parseFloat(tx.amount) || 0;
            const sign = signFor(tx.type);
            const isLocked = tx.source !== "manual";
            const label = tx.type === "value_update" ? "Value update"
              : tx.description || SOURCE_LABEL[tx.source] || "Transaction";
            return (
              <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 border border-hairline rounded-[14px]">
                <div className="min-w-0 flex items-center gap-1.5">
                  {isLocked && <Lock className="h-3 w-3 shrink-0 text-ink-30" aria-label="Automatic entry, locked" />}
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-forest truncate">{label}</p>
                    <p className="text-[12px] text-ink-40">
                      {fmtDate(tx.transactionDate)} · {SOURCE_LABEL[tx.source] ?? tx.source}
                      {tx.units ? ` · ${parseFloat(tx.units)} units` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={cn("text-[13.5px] font-semibold tabular-nums", sign > 0 ? "text-green" : sign < 0 ? "text-clay" : "text-forest")}>
                    {sign > 0 ? "+" : sign < 0 ? "-" : ""}{fmtUsd(amt)}
                  </span>
                  {!isLocked && (
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="text-[12px] text-ink-30 hover:text-clay"
                      aria-label="Delete transaction"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="w-full min-h-11 flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-hairline text-[13.5px] font-semibold text-ink-40 hover:border-green hover:text-green transition-colors"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Add transaction
      </button>

      <BottomSheet isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add transaction">
        <div className="space-y-3">
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
            <label className="text-[12.5px] font-medium text-ink-40 mb-1 block">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as HoldingTransactionType)}
              className="w-full min-h-11 px-3 rounded-xl border border-hairline text-[14px] bg-surface focus:outline-none focus:ring-2 focus:ring-green"
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
          {isUnitsBased && (
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
          <div className="flex gap-2 pt-1">
            <button onClick={() => setAddOpen(false)} className="flex-1 min-h-11 rounded-xl border border-hairline text-[14px] text-ink-40">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={adding || !(parseFloat(amount) > 0)}
              className="flex-1 min-h-11 rounded-xl bg-green text-white text-[14px] font-semibold disabled:opacity-50"
            >
              {adding ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}
