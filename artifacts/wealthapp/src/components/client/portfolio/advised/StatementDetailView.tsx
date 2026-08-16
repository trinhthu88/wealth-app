import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvisedPlanStatement, AdvisedPlanHolding } from "@/hooks/useAdvisedPlans";

interface Transaction {
  id: string;
  transactionDate: string;
  fundCode: string;
  fundName?: string | null;
  description: string;
  netAmount: string;
  unitValue?: string | null;
  unitsThisTransaction?: string | null;
}

interface Props {
  statement: AdvisedPlanStatement;
  holdings: AdvisedPlanHolding[];
  transactions?: Transaction[];
}

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }
function fmt(v: number) {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v >= 0 ? `+$${abs}` : `-$${abs}`;
}
function fmtAbs(v: number) {
  return `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StatementDetailView({ statement: s, holdings, transactions }: Props) {
  const [feesExpanded, setFeesExpanded] = useState(false);
  const [txExpanded, setTxExpanded] = useState(false);

  const opening = n(s.openingValue);
  const contribs = n(s.contributions);
  const extras = n(s.extraAllocations);
  const policyFee = n(s.policyFee);
  const amc = n(s.assetManagementFee);
  const admin = n(s.adminCharges);
  const advisory = n(s.advisoryServicesFee);
  const spread = n(s.bidOfferSpread);
  const returns = n(s.investmentReturns);
  const closing = n(s.closingValue);
  const totalFees = Math.abs(policyFee) + Math.abs(amc) + Math.abs(admin) + Math.abs(advisory) + Math.abs(spread);

  const rows = [
    { label: "Opening value", value: opening, neutral: true },
    { label: "Contributions", value: contribs },
    { label: "Extra allocations", value: extras },
    { label: "Total fees", value: -totalFees, expandable: true },
    { label: "Investment returns", value: returns },
  ];

  const fundTotal = holdings.reduce((s, h) => s + n(h.finalValue ?? h.holdingValue), 0);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* LEFT: Waterfall */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Period activity</p>
          {rows.map((r, i) => (
            <div key={i}>
              <div className={cn("flex items-center justify-between py-1.5 text-sm", r.neutral && "font-semibold text-[#042C53]")}>
                <div className="flex items-center gap-1">
                  {r.expandable && (
                    <button onClick={() => setFeesExpanded(v => !v)} className="text-slate-400 hover:text-slate-600">
                      {feesExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <span className={r.neutral ? "" : "text-slate-600"}>{r.label}</span>
                </div>
                <span className={cn("font-medium tabular-nums", r.neutral ? "text-[#042C53]" : r.value >= 0 ? "text-emerald-600" : "text-red-500")}>
                  {r.neutral ? fmtAbs(r.value) : fmt(r.value)}
                </span>
              </div>
              {r.expandable && feesExpanded && (
                <div className="ml-6 space-y-1 pb-1">
                  {[
                    { l: "Policy fee", v: policyFee }, { l: "Asset mgmt fee", v: amc },
                    { l: "Admin charges", v: admin }, { l: "Advisory services", v: advisory },
                    { l: "Bid/offer spread", v: spread },
                  ].filter(f => Math.abs(f.v) > 0).map((f, j) => (
                    <div key={j} className="flex justify-between text-xs text-slate-500">
                      <span>{f.l}</span>
                      <span className="text-red-400 tabular-nums">{fmt(f.v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-sm font-bold text-[#042C53]">
            <span>Closing value</span>
            <span className="tabular-nums">{fmtAbs(closing)}</span>
          </div>
        </div>

        {/* RIGHT: Fund table */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fund holdings at period end</p>
          {holdings.length === 0 ? (
            <p className="text-sm text-slate-400">No fund data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 text-slate-400 font-medium">Code</th>
                    <th className="text-right py-1.5 text-slate-400 font-medium">Units</th>
                    <th className="text-right py-1.5 text-slate-400 font-medium">Price</th>
                    <th className="text-right py-1.5 text-slate-400 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 text-[#042C53] font-mono font-medium">{h.fundCode}</td>
                      <td className="py-1.5 text-right text-slate-600 tabular-nums">{parseFloat(h.unitsHeld ?? "0").toFixed(2)}</td>
                      <td className="py-1.5 text-right text-slate-600 tabular-nums">${parseFloat(h.unitValue ?? "0").toFixed(2)}</td>
                      <td className="py-1.5 text-right font-medium text-[#042C53] tabular-nums">${n(h.finalValue ?? h.holdingValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold text-[#042C53]">
                    <td className="py-1.5" colSpan={3}>Total</td>
                    <td className="py-1.5 text-right tabular-nums">${fundTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  </tr>
                </tbody>
              </table>
              {Math.abs(fundTotal - closing) > 2 && (
                <p className="text-[11px] text-slate-400 mt-1">* Minor rounding difference</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transactions (full_detail mode) */}
      {transactions && transactions.length > 0 && (
        <div>
          <button
            onClick={() => setTxExpanded(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]"
          >
            {txExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {txExpanded ? "Hide" : "Show"} transactions ({transactions.length})
          </button>
          {txExpanded && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 text-slate-400 font-medium">Date</th>
                    <th className="text-left py-1.5 text-slate-400 font-medium">Fund</th>
                    <th className="text-left py-1.5 text-slate-400 font-medium">Description</th>
                    <th className="text-right py-1.5 text-slate-400 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => {
                    const amt = n(t.netAmount);
                    return (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-1 text-slate-500 tabular-nums">{new Date(t.transactionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                        <td className="py-1 font-mono text-[#042C53]">{t.fundCode}</td>
                        <td className="py-1 text-slate-600">{t.description}</td>
                        <td className={cn("py-1 text-right font-medium tabular-nums", amt >= 0 ? "text-emerald-600" : "text-red-500")}>
                          {fmt(amt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
