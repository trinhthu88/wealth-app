import { useState } from "react";
import { Plus, X, Loader2, CalendarClock, Briefcase, Layers3 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "new_plan" | "new_statement";

const PLAN_TYPES = [
  { id: "rsp", label: "Regular Savings Plan", icon: CalendarClock },
  { id: "lump_sum", label: "Lump Sum", icon: Briefcase },
  { id: "combination", label: "Both", icon: Layers3 },
];

const TX_DESCRIPTIONS = [
  "Net Contribution", "Extra Allocation", "Policy Fee", "Asset Management Fee",
  "Administrative Charge", "Advisory Services Fee", "Bid/Offer Spread",
  "Surrender", "Surrender Charge", "Investment Return", "Switch In", "Switch Out", "Other",
];

interface FundRow { fundCode: string; fundName: string; unitValueDate: string; unitValue: string; unitsHeld: string; holdingValue: string; futureAllocationPct: string; }
interface TxRow { fundCode: string; transactionDate: string; description: string; netAmount: string; unitValue: string; unitsThisTransaction: string; }

function emptyFund(): FundRow { return { fundCode: "", fundName: "", unitValueDate: "", unitValue: "", unitsHeld: "", holdingValue: "", futureAllocationPct: "0" }; }
function emptyTx(): TxRow { return { fundCode: "", transactionDate: "", description: "Net Contribution", netAmount: "", unitValue: "", unitsThisTransaction: "" }; }

function n(v: string) { return parseFloat(v) || 0; }
function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
function Input({ value, onChange, placeholder, type = "text", step, className }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; step?: string; className?: string }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={step} className={cn("w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]", className)} />;
}

interface Props {
  mode: Mode;
  clientId: string;
  planId?: string;  // for new_statement mode
  existingNetContribution?: number;  // for running total calculation
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StatementEntryForm({ mode, clientId, planId, existingNetContribution = 0, onSuccess, onCancel }: Props) {
  // Plan fields
  const [providerName, setProviderName] = useState("");
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [introducerCode, setIntroducerCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [planType, setPlanType] = useState("rsp");
  const [currency, setCurrency] = useState("USD");
  const [termYears, setTermYears] = useState("");
  const [annualPremium, setAnnualPremium] = useState("");
  const [initialPremium, setInitialPremium] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [status, setStatus] = useState("inforce");

  // Statement fields
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [statementDate, setStatementDate] = useState("");
  const [entryMode, setEntryMode] = useState<"summary" | "full_detail">("summary");
  const [openingValue, setOpeningValue] = useState("");
  const [closingValue, setClosingValue] = useState("");
  const [contributions, setContributions] = useState("0");
  const [extraAllocations, setExtraAllocations] = useState("0");
  const [policyFee, setPolicyFee] = useState("0");
  const [amc, setAmc] = useState("0");
  const [adminCharges, setAdminCharges] = useState("0");
  const [advisoryFee, setAdvisoryFee] = useState("0");
  const [bidSpread, setBidSpread] = useState("0");
  const [surrenders, setSurrenders] = useState("0");
  const [surrenderCharges, setSurrenderCharges] = useState("0");
  const [investmentReturns, setInvestmentReturns] = useState("0");
  const [funds, setFunds] = useState<FundRow[]>([emptyFund()]);
  const [transactions, setTransactions] = useState<TxRow[]>([emptyTx()]);
  const [saving, setSaving] = useState(false);

  // Reconciliation
  const calcClosing = n(openingValue) + n(contributions) + n(extraAllocations) - n(policyFee) - n(amc) - n(adminCharges) - n(advisoryFee) - n(bidSpread) + n(investmentReturns);
  const diff = Math.abs(calcClosing - n(closingValue));

  async function handleSave() {
    setSaving(true);
    try {
      if (mode === "new_plan") {
        if (!providerName || !productName || !effectiveDate) { toast.error("Fill required fields."); return; }
        await apiFetch(`/advisor/clients/${clientId}/advised-plans`, {
          method: "POST",
          body: JSON.stringify({ providerName, productName, productCode: productCode || null, policyNumber: policyNumber || null, introducerCode: introducerCode || null, nickname: nickname || null, planType, currency, termYears: termYears ? parseInt(termYears) : null, annualPremium: planType !== "lump_sum" ? parseFloat(annualPremium) || 0 : 0, initialPremium: planType !== "rsp" ? parseFloat(initialPremium) || 0 : 0, effectiveDate, maturityDate: maturityDate || null, status, latestAccountValue: 0, latestNetContribution: 0 }),
        });
        toast.success(`Plan '${nickname || productName}' created.`);
      } else {
        if (!planId || !periodStart || !periodEnd || !openingValue || !closingValue) { toast.error("Fill required fields."); return; }
        const newNetContrib = existingNetContribution + n(contributions) + n(extraAllocations);
        await apiFetch(`/advisor/clients/${clientId}/advised-plans/${planId}/statements`, {
          method: "POST",
          body: JSON.stringify({
            periodStart, periodEnd, statementDate: statementDate || null, entryMode,
            openingValue: n(openingValue), closingValue: n(closingValue),
            contributions: n(contributions), extraAllocations: n(extraAllocations),
            policyFee: -Math.abs(n(policyFee)), assetManagementFee: -Math.abs(n(amc)),
            adminCharges: -Math.abs(n(adminCharges)), advisoryServicesFee: -Math.abs(n(advisoryFee)),
            bidOfferSpread: -Math.abs(n(bidSpread)), surrenders: n(surrenders),
            surrenderCharges: n(surrenderCharges), investmentReturns: n(investmentReturns),
            funds: funds.filter(f => f.fundCode && f.fundName),
            transactions: entryMode === "full_detail" ? transactions.filter(t => t.fundCode && t.description && t.netAmount) : [],
            newLatestAccountValue: n(closingValue),
            newLatestNetContribution: newNetContrib,
          }),
        });
        toast.success("Statement saved. Client portfolio updated.");
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save.");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {mode === "new_plan" && (
        <>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Plan identity</p>
            <Field label="Provider name" required><Input value={providerName} onChange={setProviderName} placeholder="e.g. Investors Trust" /></Field>
            <Field label="Product name" required><Input value={productName} onChange={setProductName} placeholder="e.g. Evolution 10 Year Plan USD" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product code"><Input value={productCode} onChange={setProductCode} placeholder="e.g. EVO10" /></Field>
              <Field label="Policy number"><Input value={policyNumber} onChange={setPolicyNumber} placeholder="e.g. T10W005382" /></Field>
            </div>
            <Field label="Client nickname (shown in portal)"><Input value={nickname} onChange={setNickname} placeholder="e.g. Retirement fund" /></Field>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Plan terms</p>
            <div className="flex gap-2">
              {PLAN_TYPES.map(pt => {
                const Icon = pt.icon;
                return (
                  <button key={pt.id} onClick={() => setPlanType(pt.id)} className={cn("flex flex-1 items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all", planType === pt.id ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]" : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/40")}>
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{pt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["USD", "VND", "EUR"] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)} className={cn("py-2 rounded-lg border text-sm font-medium", currency === c ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]" : "border-slate-200 text-slate-600")}>
                  {c}
                </button>
              ))}
            </div>
            {planType !== "lump_sum" && <Field label="Annual premium"><Input type="number" value={annualPremium} onChange={setAnnualPremium} placeholder="e.g. 24000" /></Field>}
            {planType !== "rsp" && <Field label="Initial premium"><Input type="number" value={initialPremium} onChange={setInitialPremium} placeholder="0" /></Field>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Effective date" required><Input type="date" value={effectiveDate} onChange={setEffectiveDate} /></Field>
              <Field label="Maturity date"><Input type="date" value={maturityDate} onChange={setMaturityDate} /></Field>
            </div>
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30">
                {["inforce", "paid_up", "lapsed", "matured", "surrendered"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </>
      )}

      {mode === "new_statement" && (
        <>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Statement period</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period start" required><Input type="date" value={periodStart} onChange={setPeriodStart} /></Field>
              <Field label="Period end" required><Input type="date" value={periodEnd} onChange={setPeriodEnd} /></Field>
            </div>
            <Field label="Statement date"><Input type="date" value={statementDate} onChange={setStatementDate} /></Field>
            <div className="flex gap-2">
              {(["summary", "full_detail"] as const).map(m => (
                <button key={m} onClick={() => setEntryMode(m)} className={cn("flex-1 py-2 rounded-lg border text-xs font-medium", entryMode === m ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]" : "border-slate-200 text-slate-600")}>
                  {m === "summary" ? "Summary (page 1)" : "Full detail (page 1 + 2)"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Account activity</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Opening value" required><Input type="number" value={openingValue} onChange={setOpeningValue} placeholder="0" /></Field>
              <Field label="Closing value" required><Input type="number" value={closingValue} onChange={setClosingValue} placeholder="0" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contributions"><Input type="number" value={contributions} onChange={setContributions} /></Field>
              <Field label="Extra allocations"><Input type="number" value={extraAllocations} onChange={setExtraAllocations} /></Field>
              <Field label="Policy fee (enter positive)"><Input type="number" value={policyFee} onChange={setPolicyFee} /></Field>
              <Field label="Asset mgmt fee"><Input type="number" value={amc} onChange={setAmc} /></Field>
              <Field label="Admin charges"><Input type="number" value={adminCharges} onChange={setAdminCharges} /></Field>
              <Field label="Advisory services fee"><Input type="number" value={advisoryFee} onChange={setAdvisoryFee} /></Field>
              <Field label="Investment returns (can be negative)" hint="Enter as-is from statement"><Input type="number" value={investmentReturns} onChange={setInvestmentReturns} step="any" /></Field>
            </div>

            {/* Reconciliation */}
            <div className={cn("rounded-lg px-3 py-2 text-sm border", diff <= 1 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700")}>
              <div className="flex justify-between"><span>Calculated closing:</span><span className="font-mono">${calcClosing.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
              <div className="flex justify-between"><span>Entered closing:</span><span className="font-mono">${n(closingValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
              <div className="flex justify-between font-semibold border-t border-current/20 mt-1 pt-1">
                <span>Difference:</span>
                <span className="font-mono">${diff.toLocaleString("en-US", { maximumFractionDigits: 0 })} · {diff <= 1 ? "Balanced" : "Review"}</span>
              </div>
              {diff > 1 && <p className="text-xs mt-1">Values don't reconcile — check your entries.</p>}
            </div>
          </div>

          {/* Fund snapshot */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Fund holdings snapshot</p>
              <button onClick={() => setFunds(f => [...f, emptyFund()])} className="text-xs text-[#1D9E75] font-medium flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Add fund row
              </button>
            </div>
            {funds.map((f, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5 items-start">
                <input className="col-span-2 px-2 py-1.5 rounded border border-slate-200 text-xs uppercase font-mono" value={f.fundCode} onChange={e => setFunds(ff => ff.map((r, j) => j === i ? { ...r, fundCode: e.target.value.toUpperCase() } : r))} placeholder="Code" />
                <input className="col-span-3 px-2 py-1.5 rounded border border-slate-200 text-xs" value={f.fundName} onChange={e => setFunds(ff => ff.map((r, j) => j === i ? { ...r, fundName: e.target.value } : r))} placeholder="Fund name" />
                <input type="number" className="col-span-2 px-2 py-1.5 rounded border border-slate-200 text-xs" value={f.unitsHeld} onChange={e => setFunds(ff => ff.map((r, j) => j === i ? { ...r, unitsHeld: e.target.value } : r))} placeholder="Units" />
                <input type="number" className="col-span-2 px-2 py-1.5 rounded border border-slate-200 text-xs" value={f.unitValue} onChange={e => setFunds(ff => ff.map((r, j) => j === i ? { ...r, unitValue: e.target.value } : r))} placeholder="Price" />
                <input type="number" className="col-span-2 px-2 py-1.5 rounded border border-slate-200 text-xs" value={f.futureAllocationPct} onChange={e => setFunds(ff => ff.map((r, j) => j === i ? { ...r, futureAllocationPct: e.target.value } : r))} placeholder="Alloc%" />
                <button onClick={() => setFunds(ff => ff.filter((_, j) => j !== i))} className="col-span-1 flex justify-center items-center text-slate-400 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>

          {/* Transaction lines */}
          {entryMode === "full_detail" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Transaction lines</p>
                <button onClick={() => setTransactions(t => [...t, emptyTx()])} className="text-xs text-[#1D9E75] font-medium flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add line
                </button>
              </div>
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2">Tip: Add transaction rows one by one from statement page 2. Enter amounts exactly as shown.</p>
              {transactions.map((t, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-start">
                  <input className="col-span-2 px-2 py-1.5 rounded border border-slate-200 text-xs uppercase font-mono" value={t.fundCode} onChange={e => setTransactions(tt => tt.map((r, j) => j === i ? { ...r, fundCode: e.target.value.toUpperCase() } : r))} placeholder="Fund" />
                  <input type="date" className="col-span-3 px-2 py-1.5 rounded border border-slate-200 text-xs" value={t.transactionDate} onChange={e => setTransactions(tt => tt.map((r, j) => j === i ? { ...r, transactionDate: e.target.value } : r))} />
                  <select className="col-span-4 px-2 py-1.5 rounded border border-slate-200 text-xs bg-white" value={t.description} onChange={e => setTransactions(tt => tt.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}>
                    {TX_DESCRIPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input type="number" step="any" className="col-span-2 px-2 py-1.5 rounded border border-slate-200 text-xs" value={t.netAmount} onChange={e => setTransactions(tt => tt.map((r, j) => j === i ? { ...r, netAmount: e.target.value } : r))} placeholder="Amount" />
                  <button onClick={() => setTransactions(tt => tt.filter((_, j) => j !== i))} className="col-span-1 flex justify-center items-center text-slate-400 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#0F6E56] disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : mode === "new_plan" ? "Create plan" : "Save statement"}
        </button>
      </div>
    </div>
  );
}
