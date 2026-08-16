import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ClientAppShell from "@/components/client/AppShell";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  clientPackageId: string;
  transactionDate: string;
  transactionType: string;
  amountUsd: string;
  units: string | null;
  pricePerUnitUsd: string | null;
  notes: string | null;
  createdAt: string;
  fund: { name: string; ticker: string } | null;
  package: { nickname: string; type: string } | null;
}

const TX_TYPE_LABELS: Record<string, string> = {
  initial_investment: "Initial Investment",
  monthly_contribution: "Monthly Contribution",
  top_up: "Top Up",
  withdrawal: "Withdrawal",
  dividend_reinvested: "Dividend Reinvested",
  fee_charged: "Fee Charged",
  rebalance: "Rebalance",
};

const TX_OUTFLOWS = ["withdrawal", "fee_charged"];

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Contributions", value: "contributions" },
  { label: "Withdrawals", value: "withdrawals" },
  { label: "Dividends", value: "dividends" },
];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMonth(ym: string) {
  return new Date(ym + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState("all");

  const { data: transactions = [], isLoading, isError } = useQuery<Transaction[]>({
    queryKey: ["transactions-all"],
    queryFn: () => apiFetch("/transactions/all"),
  });

  const filtered = transactions.filter(tx => {
    if (filter === "contributions") return ["initial_investment", "monthly_contribution", "top_up"].includes(tx.transactionType);
    if (filter === "withdrawals") return TX_OUTFLOWS.includes(tx.transactionType);
    if (filter === "dividends") return tx.transactionType === "dividend_reinvested";
    return true;
  });

  const totalIn = transactions
    .filter(tx => !TX_OUTFLOWS.includes(tx.transactionType))
    .reduce((s, tx) => s + parseFloat(tx.amountUsd), 0);
  const totalOut = transactions
    .filter(tx => TX_OUTFLOWS.includes(tx.transactionType))
    .reduce((s, tx) => s + parseFloat(tx.amountUsd), 0);

  const grouped: Record<string, Transaction[]> = {};
  for (const tx of filtered) {
    const month = tx.transactionDate.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(tx);
  }
  const months = Object.keys(grouped).sort().reverse();

  return (
    <ClientAppShell>
      <div className="max-w-[860px] mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#042C53]">Transactions</h1>
          <p className="text-sm text-slate-400 mt-0.5">{transactions.length} total transactions</p>
        </div>

        {/* Summary bar */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Total contributed</p>
              <p className="text-lg font-bold text-emerald-600">{fmtCurrency(totalIn)}</p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">Total withdrawn</p>
              <p className="text-lg font-bold text-red-500">{fmtCurrency(totalOut)}</p>
            </div>
          </div>
        )}

        {/* Filter chips */}
        {transactions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                  filter === opt.value
                    ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
                    : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/30"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Couldn't load transactions</p>
            <p className="text-xs text-slate-400">Try refreshing the page.</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
            <p className="text-sm text-slate-400">No transactions yet. Your advisor will record transactions as they happen.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center">
            <p className="text-sm text-slate-400">No transactions match this filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {months.map((month) => (
              <div key={month}>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  {fmtMonth(month)}
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {grouped[month].map((tx, i) => {
                    const isOut = TX_OUTFLOWS.includes(tx.transactionType);
                    return (
                      <div key={tx.id} className={cn(
                        "flex items-center gap-3 px-4 py-3.5",
                        i < grouped[month].length - 1 && "border-b border-[#E2E8F0]"
                      )}>
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                          isOut ? "bg-red-50" : "bg-emerald-50"
                        )}>
                          {isOut
                            ? <TrendingDown className="h-4 w-4 text-red-500" />
                            : <TrendingUp className="h-4 w-4 text-emerald-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#042C53]">
                            {TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                            {tx.package?.nickname && (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                {tx.package.nickname}
                              </span>
                            )}
                            {tx.fund?.name && <span>{tx.fund.name}</span>}
                            <span>{fmtDate(tx.transactionDate)}</span>
                          </div>
                          {tx.units && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {parseFloat(tx.units).toFixed(4)} units
                              {tx.pricePerUnitUsd ? ` @ ${fmtCurrency(parseFloat(tx.pricePerUnitUsd))}` : ""}
                            </div>
                          )}
                          {tx.notes && (
                            <div className="text-xs text-slate-400 italic mt-0.5">{tx.notes}</div>
                          )}
                        </div>
                        <div className={cn(
                          "text-sm font-bold shrink-0",
                          isOut ? "text-red-500" : "text-emerald-600"
                        )}>
                          {isOut ? "-" : "+"}{fmtCurrency(parseFloat(tx.amountUsd))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClientAppShell>
  );
}
