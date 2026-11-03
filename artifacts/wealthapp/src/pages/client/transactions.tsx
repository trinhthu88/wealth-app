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
      <div className="max-w-[860px] mx-auto space-y-4 pb-8">
        <div className="px-1">
          <h1 className="font-display text-[34px] leading-[1.05] text-forest">Transactions</h1>
          <p className="text-[14px] text-ink-40 mt-1 tabular-nums">{transactions.length} total transactions</p>
        </div>

        {/* Summary bar */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-field rounded-[24px] p-4">
              <p className="tala-eyebrow text-forest mb-1.5">Total contributed</p>
              <p className="text-[18px] font-semibold text-forest tabular-nums">{fmtCurrency(totalIn)}</p>
            </div>
            <div className="bg-surface rounded-[24px] p-4">
              <p className="tala-eyebrow text-ink-40 mb-1.5">Total withdrawn</p>
              <p className="text-[18px] font-semibold text-forest tabular-nums">{fmtCurrency(totalOut)}</p>
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
                  "min-h-11 px-4 rounded-full text-[13px] font-semibold transition-colors",
                  filter === opt.value
                    ? "bg-forest text-paper"
                    : "bg-surface text-forest hover:bg-green-tint"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-surface rounded-[24px] animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="bg-surface rounded-[24px] p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
            <p className="text-[15px] font-semibold text-forest">Couldn't load transactions</p>
            <p className="text-[13px] text-ink-40">Try refreshing the page.</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-surface rounded-[24px] p-8 text-center">
            <p className="text-[14px] text-ink-40">No transactions yet. Your advisor will record transactions as they happen.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface rounded-[24px] p-8 text-center">
            <p className="text-[14px] text-ink-40">No transactions match this filter.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {months.map((month) => (
              <div key={month}>
                <h2 className="text-[16px] font-semibold text-forest mb-3 px-1">
                  {fmtMonth(month)}
                </h2>
                <div className="bg-surface rounded-[24px] p-1">
                  {grouped[month].map((tx, i) => {
                    const isOut = TX_OUTFLOWS.includes(tx.transactionType);
                    return (
                      <div key={tx.id} className={cn(
                        "flex items-center gap-3 p-3",
                        i < grouped[month].length - 1 && "border-b border-hairline"
                      )}>
                        <div className={cn(
                          "w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 text-forest",
                          isOut ? "bg-breeze" : "bg-field"
                        )}>
                          {isOut
                            ? <TrendingDown className="h-4 w-4" aria-hidden="true" />
                            : <TrendingUp className="h-4 w-4" aria-hidden="true" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-medium text-forest">
                            {TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}
                          </div>
                          <div className="text-[13px] text-ink-40 flex items-center gap-1.5 flex-wrap mt-0.5">
                            {tx.package?.nickname && (
                              <span className="bg-paper px-2 py-0.5 rounded-full text-[12px] font-medium text-forest">
                                {tx.package.nickname}
                              </span>
                            )}
                            {tx.fund?.name && <span>{tx.fund.name}</span>}
                            <span>{fmtDate(tx.transactionDate)}</span>
                          </div>
                          {tx.units && (
                            <div className="text-[12px] text-ink-40 mt-0.5 tabular-nums">
                              {parseFloat(tx.units).toFixed(4)} units
                              {tx.pricePerUnitUsd ? ` @ ${fmtCurrency(parseFloat(tx.pricePerUnitUsd))}` : ""}
                            </div>
                          )}
                          {tx.notes && (
                            <div className="text-[12px] text-ink-40 italic mt-0.5">{tx.notes}</div>
                          )}
                        </div>
                        <div className={cn(
                          "text-[14px] font-semibold tabular-nums shrink-0",
                          isOut ? "text-clay-ink" : "text-forest"
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
