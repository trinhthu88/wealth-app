import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
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
  currency: string;
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

const STATUS_COLORS: Record<string, string> = {
  inforce: "bg-emerald-100 text-emerald-700",
  paid_up: "bg-blue-100 text-blue-700",
  lapsed: "bg-red-100 text-red-700",
  matured: "bg-slate-100 text-slate-600",
  surrendered: "bg-red-100 text-red-600",
};

function n(v: string | number | null | undefined) { return parseFloat(String(v ?? "0")) || 0; }

function PlanCard({ plan, clientId }: { plan: AdvisedPlan; clientId: string }) {
  const qc = useQueryClient();
  const [stmtsOpen, setStmtsOpen] = useState(false);
  const [addingStatement, setAddingStatement] = useState(false);

  const { data: statements = [] } = useQuery<Statement[]>({
    queryKey: ["advisor-plan-statements", plan.id],
    queryFn: () => apiFetch(`/advisor/clients/${clientId}/advised-plans/${plan.id}/statements`),
    enabled: stmtsOpen,
  });

  const cv = n(plan.latestAccountValue);
  const nc = n(plan.latestNetContribution);
  const gain = cv - nc;
  const isPos = gain >= 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[plan.status] ?? "bg-slate-100 text-slate-600")}>
                {plan.status}
              </span>
              <p className="text-sm font-semibold text-[#042C53]">{plan.nickname ?? plan.productName}</p>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{plan.providerName}{plan.policyNumber ? ` · ${plan.policyNumber}` : ""}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setAddingStatement(v => !v)} className="px-2.5 py-1 rounded-lg bg-[#1D9E75] text-white text-xs font-medium flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add statement
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><p className="text-slate-400">Net contribution</p><p className="font-semibold text-[#042C53]">${nc.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p></div>
          <div><p className="text-slate-400">Account value</p><p className="font-semibold text-[#042C53]">${cv.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p></div>
          <div><p className="text-slate-400">Gain / loss</p><p className={cn("font-semibold", isPos ? "text-emerald-600" : "text-red-500")}>{isPos ? "+" : "-"}${Math.abs(gain).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p></div>
        </div>

        <button onClick={() => setStmtsOpen(v => !v)} className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          {stmtsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {statements.length} statement{statements.length !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Add statement form */}
      {addingStatement && (
        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-[#042C53] mb-4">New statement</p>
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
        <div className="border-t border-slate-100">
          {statements.length === 0 ? (
            <p className="text-sm text-slate-400 px-4 py-3">No statements yet.</p>
          ) : (
            [...statements].sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime()).map(stmt => {
              const ret = n(stmt.investmentReturns);
              const isRetPos = ret >= 0;
              return (
                <div key={stmt.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 text-sm">
                  <div>
                    <p className="font-medium text-[#042C53]">
                      {new Date(stmt.periodStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – {new Date(stmt.periodEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                    <p className="text-xs text-slate-400">Closing: ${n(stmt.closingValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs font-medium", isRetPos ? "text-emerald-600" : "text-red-500")}>
                      {isRetPos ? "+" : "-"}${Math.abs(ret).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full", stmt.entryMode === "full_detail" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500")}>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-[#042C53]">Advised Investment Plans</p>
        <button onClick={() => setAddingPlan(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium hover:bg-[#0F6E56]">
          <Plus className="h-4 w-4" /> Add plan
        </button>
      </div>

      {addingPlan && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-[#042C53] mb-4">New advised plan</p>
          <StatementEntryForm
            mode="new_plan"
            clientId={clientId}
            onSuccess={() => { setAddingPlan(false); qc.invalidateQueries({ queryKey: ["advisor-client-plans", clientId] }); toast.success("Plan created!"); }}
            onCancel={() => setAddingPlan(false)}
          />
        </div>
      )}

      {plans.length === 0 && !addingPlan ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm text-slate-400">No investment plans yet.</p>
          <button onClick={() => setAddingPlan(true)} className="mt-2 text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">+ Create first plan</button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} clientId={clientId} />)}
        </div>
      )}
    </div>
  );
}
