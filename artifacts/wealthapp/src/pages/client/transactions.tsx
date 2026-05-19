import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { TrendingUp, TrendingDown } from "lucide-react";

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

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions-all"],
    queryFn: () => apiFetch("/transactions/all"),
  });

  const grouped: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const month = tx.transactionDate.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(tx);
  }
  const months = Object.keys(grouped).sort().reverse();

  return (
    <AppShell>
      <PageHeader title="Transaction History" subtitle={`${transactions.length} transactions`} />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No transactions yet. Your advisor will record transactions as they happen.
        </div>
      ) : (
        <div className="space-y-6">
          {months.map((month, mi) => (
            <motion.div key={month} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: mi * 0.04 }}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                {grouped[month].map((tx, i) => {
                  const isOut = TX_OUTFLOWS.includes(tx.transactionType);
                  return (
                    <div key={tx.id} className={`flex items-center gap-3 px-4 py-3.5 ${i < grouped[month].length - 1 ? "border-b border-border" : ""}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isOut ? "bg-red-50" : "bg-emerald-50"}`}>
                        {isOut ? <TrendingDown className="h-4 w-4 text-red-500" /> : <TrendingUp className="h-4 w-4 text-emerald-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {tx.package?.nickname && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{tx.package.nickname}</span>}
                          {tx.fund?.name && <span>{tx.fund.name}</span>}
                          <span>{tx.transactionDate}</span>
                        </div>
                        {tx.units && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {parseFloat(tx.units).toFixed(4)} units @ {tx.pricePerUnitUsd ? fmtCurrency(parseFloat(tx.pricePerUnitUsd)) : "—"}
                          </div>
                        )}
                        {tx.notes && <div className="text-xs text-muted-foreground italic mt-0.5">{tx.notes}</div>}
                      </div>
                      <div className={`text-sm font-bold shrink-0 ${isOut ? "text-red-500" : "text-emerald-600"}`}>
                        {isOut ? "-" : "+"}{fmtCurrency(parseFloat(tx.amountUsd))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
