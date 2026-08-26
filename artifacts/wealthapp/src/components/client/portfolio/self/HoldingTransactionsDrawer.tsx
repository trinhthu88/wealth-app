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

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatUsd(value: number) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function signFor(type: HoldingTransactionType) {
  if (type === "in") return 1;
  if (type === "out" || type === "fee") return -1;
  return 0;
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
    const parsedAmount = parseFloat(amount);
    if (!(parsedAmount > 0)) return;
    await addTransaction({
      type,
      amount: parsedAmount,
      transactionDate: date,
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
          {[0, 1, 2].map((index) => <div key={index} className="h-12 bg-hairline/60 animate-pulse rounded-lg" />)}
        </div>
      ) : transactions.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ink-40">No transactions yet.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {transactions.map((transaction) => {
            const amountValue = parseFloat(transaction.amount) || 0;
            const sign = signFor(transaction.type);
            const isLocked = transaction.source !== "manual";
            const label = transaction.type === "value_update"
              ? "Value update"
              : transaction.description || SOURCE_LABEL[transaction.source] || "Transaction";
            return (
              <div key={transaction.id} className="flex items-center justify-between rounded-[14px] border border-hairline px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  {isLocked && <Lock className="h-3 w-3 shrink-0 text-ink-30" aria-label="Automatic entry, locked" />}
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-forest">{label}</p>
                    <p className="text-[12px] text-ink-40">
                      {formatDate(transaction.transactionDate)} · {SOURCE_LABEL[transaction.source] ?? transaction.source}
                      {transaction.units ? ` · ${parseFloat(transaction.units)} units` : ""}
                    </p>
                  </div>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span className={cn("text-[13.5px] font-semibold tabular-nums", sign > 0 ? "text-green" : sign < 0 ? "text-clay" : "text-forest")}>
                    {sign > 0 ? "+" : sign < 0 ? "-" : ""}{formatUsd(amountValue)}
                  </span>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => deleteTransaction(transaction.id)}
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
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-hairline text-[13.5px] font-semibold text-ink-40 transition-colors hover:border-green hover:text-green"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Add transaction
      </button>

      <BottomSheet isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add transaction">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-40">Date</label>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-hairline px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-green" />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-40">Type</label>
            <select value={type} onChange={(event) => setType(event.target.value as HoldingTransactionType)} className="min-h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-green">
              {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-40">{type === "value_update" ? "New value" : "Amount"}</label>
            <input type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className="min-h-11 w-full rounded-xl border border-hairline px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-green" />
          </div>
          {isUnitsBased && (
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-ink-40">Units (optional)</label>
              <input type="number" min={0} value={units} onChange={(event) => setUnits(event.target.value)} placeholder="0" className="min-h-11 w-full rounded-xl border border-hairline px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-green" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-40">Note (optional)</label>
            <input type="text" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" className="min-h-11 w-full rounded-xl border border-hairline px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-green" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setAddOpen(false)} className="min-h-11 flex-1 rounded-xl border border-hairline text-[14px] text-ink-40">Cancel</button>
            <button type="button" onClick={handleAdd} disabled={adding || !(parseFloat(amount) > 0)} className="min-h-11 flex-1 rounded-xl bg-green text-[14px] font-semibold text-white disabled:opacity-50">
              {adding ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}