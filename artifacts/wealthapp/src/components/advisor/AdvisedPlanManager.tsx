import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronDown, ChevronRight, Pencil, Check, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import CurrencyInput from "@/components/CurrencyInput";
import StatementEntryForm from "./StatementEntryForm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AdvisedPlan {
  id: string;
  providerName: string;
  productName: string;
  policyNumber: string | null;
  nickname: string | null;
  status: string;
  latestAccountValue: string;
  latestNetContribution: string;
  planType: string;
  annualPremium: string;
  initialPremium: string;
  currency: string;
}

// Not fmtCurrency from portfolioCalculations — that helper abbreviates values
// over 1,000 with a hardcoded "$", which would mislabel a non-USD plan's
// contribution. This always uses the plan's own currency, unabbreviated.
function fmtPlanCurrency(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

interface Statement {
  id: string;
  periodStart: string;
  periodEnd: string;
  closingValue: string;
  investmentReturns: string;
  entryMode: string;
  createdAt: string;
}

// scenario | inforce | matured | surrender — see advisedPlans.ts's schema
// comment. A plan starts as scenario and only becomes inforce once an advisor
// explicitly flips it (requires a policyNumber, enforced server-side).
const STATUS_COLORS: Record<string, string> = {
  scenario: "bg-sun-tint text-amber-ink",
  inforce: "bg-green-tint text-green",
  matured: "bg-surface border border-hairline text-ink-60",
  surrender: "bg-clay-tint text-clay-ink",
};

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

function PlanCard({ plan, clientId }: { plan: AdvisedPlan; clientId: string }) {
  const qc = useQueryClient();
  const [stmtsOpen, setStmtsOpen] = useState(false);
  const [addingStatement, setAddingStatement] = useState(false);
  const [editingContribution, setEditingContribution] = useState(false);
  const [monthlyDraft, setMonthlyDraft] = useState(0);
  const [lumpDraft, setLumpDraft] = useState(0);

  const { data: statements = [] } = useQuery<Statement[]>({
    queryKey: ["advisor-plan-statements", plan.id],
    queryFn: () => apiFetch(`/advisor/clients/${clientId}/advised-plans/${plan.id}/statements`),
    enabled: stmtsOpen,
  });

  const updateStatusMut = useMutation({
    mutationFn: (data: { status: string; policyNumber?: string }) =>
      apiFetch(`/advised-plans/${plan.id}/status`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advisor-client-plans", clientId] });
      toast.success("Plan is now in-force");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update plan status"),
  });

  const updateContributionMut = useMutation({
    mutationFn: (data: { annualPremium?: number; initialPremium?: number }) =>
      apiFetch(`/advised-plans/${plan.id}/contribution`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advisor-client-plans", clientId] });
      setEditingContribution(false);
      toast.success("Contribution updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update contribution"),
  });

  function handleMarkInForce() {
    let policyNumber = plan.policyNumber;
    if (!policyNumber) {
      const entered = prompt("Enter the policy number to mark this plan in-force:");
      if (!entered) return;
      policyNumber = entered;
    }
    updateStatusMut.mutate({ status: "inforce", policyNumber });
  }

  function toggleEditingContribution() {
    if (!editingContribution) {
      setMonthlyDraft(Math.round(n(plan.annualPremium) / 12));
      setLumpDraft(n(plan.initialPremium));
    }
    setEditingContribution(v => !v);
  }

  const cv = n(plan.latestAccountValue);
  const nc = n(plan.latestNetContribution);
  const gain = cv - nc;
  const isPos = gain >= 0;
  const showsMonthly = plan.planType === "rsp" || plan.planType === "combination";
  const showsLumpSum = plan.planType === "lump_sum" || plan.planType === "combination";

  return (
    <div className="bg-surface border border-hairline rounded-[24px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn("text-[12px] px-2 py-0.5 rounded-[8px] font-medium tracking-wide uppercase", STATUS_COLORS[plan.status] ?? "bg-surface border border-hairline text-ink-60")}>
                {plan.status.replace(/_/g, " ")}
              </span>
              <h4 className="text-[16px] font-semibold text-forest">{plan.nickname ?? plan.productName}</h4>
            </div>
            <p className="text-[13px] text-ink-40 tracking-wide">{plan.providerName}{plan.policyNumber ? ` · ${plan.policyNumber}` : ""}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {plan.status === "scenario" && (
              <button onClick={handleMarkInForce} disabled={updateStatusMut.isPending} className="px-3 py-1.5 rounded-full bg-forest text-paper text-[13px] font-medium hover:bg-forest-700 transition-colors disabled:opacity-50">
                {updateStatusMut.isPending ? "Updating…" : "Mark in-force"}
              </button>
            )}
            <button onClick={() => setAddingStatement(v => !v)} className="px-3 py-1.5 rounded-full bg-green text-surface text-[13px] font-medium flex items-center gap-1.5 hover:bg-green-300 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add statement
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-[13px]">
          <div><p className="text-ink-60 mb-1">Net contribution</p><p className="font-semibold text-forest text-[15px] tabular-nums">${nc.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p></div>
          <div><p className="text-ink-60 mb-1">Account value</p><p className="font-semibold text-forest text-[15px] tabular-nums">${cv.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p></div>
          <div><p className="text-ink-60 mb-1">Gain / loss</p><p className={cn("font-semibold text-[15px] tabular-nums", isPos ? "text-green" : "text-clay")}>{isPos ? "+" : "-"}${Math.abs(gain).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p></div>
        </div>

        <div className="mt-4 pt-4 border-t border-hairline">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              {showsMonthly && (
                <span className="text-ink-60">Monthly contribution <span className="font-semibold text-forest">{fmtPlanCurrency(n(plan.annualPremium) / 12, plan.currency)}</span></span>
              )}
              {showsLumpSum && (
                <span className="text-ink-60">Lump sum <span className="font-semibold text-forest">{fmtPlanCurrency(n(plan.initialPremium), plan.currency)}</span></span>
              )}
            </div>
            <button
              onClick={toggleEditingContribution}
              aria-label={editingContribution ? "Cancel editing contribution" : "Edit contribution"}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-ink-40 hover:text-green hover:bg-paper transition-colors shrink-0"
            >
              {editingContribution ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
          </div>

          {editingContribution && (
            <div className="mt-3 space-y-3">
              {showsMonthly && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-ink-60 block">Monthly contribution</label>
                  <CurrencyInput value={monthlyDraft} onChange={setMonthlyDraft} currency={plan.currency} />
                </div>
              )}
              {showsLumpSum && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-ink-60 block">Lump sum amount</label>
                  <CurrencyInput value={lumpDraft} onChange={setLumpDraft} currency={plan.currency} />
                </div>
              )}
              <button
                onClick={() => updateContributionMut.mutate({
                  ...(showsMonthly ? { annualPremium: monthlyDraft * 12 } : {}),
                  ...(showsLumpSum ? { initialPremium: lumpDraft } : {}),
                })}
                disabled={updateContributionMut.isPending}
                className="px-3 py-1.5 rounded-full bg-green text-surface text-[13px] font-medium flex items-center gap-1.5 hover:bg-green-300 transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> {updateContributionMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        <button onClick={() => setStmtsOpen(v => !v)} className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-ink-40 hover:text-green transition-colors">
          {stmtsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {statements.length} statement{statements.length !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Add statement form */}
      {addingStatement && (
        <div className="border-t border-hairline bg-paper p-5">
          <p className="text-[15px] font-semibold text-forest mb-4">New statement</p>
          <StatementEntryForm
            mode="new_statement"
            clientId={clientId}
            planId={plan.id}
            existingNetContribution={nc}
            onSuccess={() => { setAddingStatement(false); qc.invalidateQueries({ queryKey: ["advisor-plan-statements", plan.id] }); qc.invalidateQueries({ queryKey: ["advised-plans"] }); }}
            onCancel={() => setAddingStatement(false)}
          />
        </div>
      )}

      {/* Statements list */}
      {stmtsOpen && (
        <div className="border-t border-hairline">
          {statements.length === 0 ? (
            <p className="text-[14px] text-ink-40 px-5 py-4">No statements yet.</p>
          ) : (
            [...statements].sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()).map(stmt => {
              const ret = n(stmt.investmentReturns);
              const isRetPos = ret >= 0;
              return (
                <div key={stmt.id} className="flex items-center justify-between px-5 py-3.5 border-b border-hairline hover:bg-paper transition-colors text-[14px] last:border-0">
                  <div>
                    <p className="font-medium text-forest">
                      {new Date(stmt.periodStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – {new Date(stmt.periodEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[13px] text-ink-60 mt-0.5">Closing: ${n(stmt.closingValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn("text-[14px] font-semibold tabular-nums", isRetPos ? "text-green" : "text-clay")}>
                      {isRetPos ? "+" : "-"}${Math.abs(ret).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", stmt.entryMode === "full_detail" ? "bg-sun-tint text-amber-ink" : "bg-surface border border-hairline text-ink-60")}>
                      {stmt.entryMode === "full_detail" ? "Full detail" : "Summary"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

interface Props { clientId: string; }

export default function AdvisedPlanManager({ clientId }: Props) {
  const qc = useQueryClient();
  const [addingPlan, setAddingPlan] = useState(false);

  const { data: plans = [] } = useQuery<AdvisedPlan[]>({
    queryKey: ["advisor-client-plans", clientId],
    queryFn: () => apiFetch(`/advisor/clients/${clientId}/advised-plans`),
  });

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[20px] font-semibold text-forest">Advised Investment Plans</h3>
        <button onClick={() => setAddingPlan(v => !v)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-forest text-paper text-[13px] font-medium hover:bg-forest-700 transition-colors">
          <Plus className="h-4 w-4" /> Add plan
        </button>
      </div>

      {addingPlan && (
        <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-xl">
          <p className="text-[16px] font-semibold text-forest mb-5">New advised plan</p>
          <StatementEntryForm
            mode="new_plan"
            clientId={clientId}
            onSuccess={() => { setAddingPlan(false); qc.invalidateQueries({ queryKey: ["advisor-client-plans", clientId] }); toast.success("Plan created!"); }}
            onCancel={() => setAddingPlan(false)}
          />
        </div>
      )}

      {plans.length === 0 && !addingPlan ? (
        <div className="py-10 text-center border-2 border-dashed border-hairline rounded-[26px] bg-paper">
          <p className="text-[14px] text-ink-40 mb-3">No investment plans yet.</p>
          <button onClick={() => setAddingPlan(true)} className="text-[14px] font-semibold text-green hover:text-forest transition-colors">+ Create first plan</button>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} clientId={clientId} />)}
        </div>
      )}
    </div>
  );
}
