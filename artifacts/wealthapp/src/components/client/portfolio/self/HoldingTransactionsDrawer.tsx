import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";
import { useHoldingTransactions } from "@/hooks/useHoldingTransactions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  holdingId: string;
  holdingLabel: string;
  isCash: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual entry",
  budget_contribution: "Budget contribution",
  surplus_sweep: "Surplus auto-sweep",
};

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtUsd(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default function HoldingTransactionsDrawer({ isOpen, onClose, holdingId, holdingLabel, isCash }: Props) {
  const { transactions, loading, addTransaction, deleteTransaction, adding } = useHoldingTransactions(isOpen ? holdingId : null);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  async function handleAdd() {
    const amt = parseFloat(amount);
    if (!(amt > 0)) return;
    await addTransaction({ type, amount: amt, description: description || undefined });
    setAmount("");
    setDescription("");
    setShowAdd(false);
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`${holdingLabel} — Transactions`}>
      {!isCash && (
        <p className="text-xs text-slate-400 mb-3">
          This is a history log — recording a transaction here doesn't change this holding's tracked value.
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />)}
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No transactions yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {transactions.map(tx => {
            const amt = parseFloat(tx.amount) || 0;
            const isIn = tx.type === "in";
            return (
              <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 border border-slate-100 rounded-xl">
                <div className="min-w-0">
                  <p className="text-sm text-[#042C53] truncate">{tx.description || SOURCE_LABEL[tx.source] || "Transaction"}</p>
                  <p className="text-xs text-slate-400">{fmtDate(tx.transactionDate)} · {SOURCE_LABEL[tx.source] ?? tx.source}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={cn("text-sm font-semibold", isIn ? "text-emerald-600" : "text-red-500")}>
                    {isIn ? "+" : "-"}{fmtUsd(amt)}
                  </span>
                  {tx.source === "manual" && (
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="text-xs text-slate-400 hover:text-red-500"
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

      {showAdd ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setType("in")}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium border", type === "in" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500")}
            >
              Money in
            </button>
            <button
              onClick={() => setType("out")}
              className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium border", type === "out" ? "bg-red-50 border-red-200 text-red-600" : "border-slate-200 text-slate-500")}
            >
              Money out
            </button>
          </div>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full min-h-10 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full min-h-10 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={adding || !(parseFloat(amount) > 0)}
              className="flex-1 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-50"
            >
              {adding ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-slate-400"
        >
          + Add transaction
        </button>
      )}
    </BottomSheet>
  );
}
