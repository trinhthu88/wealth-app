// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: BottomSheet spring (add/edit holding sheets)
// ✓ ALLOWED: Donut chart draw animation (Recharts default)
// ✓ ALLOWED: Price refresh spinner while fetching
// ✗ BANNED:  Page-load stagger on any section or card
// ✗ BANNED:  Hero gradient card (no #042C53 → #0a4a8a background)
// ✗ BANNED:  Fake filters (no UI controls that don't actually filter)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import ClientAppShell from "@/components/client/AppShell";
import AddHoldingSheet from "@/components/client/portfolio/self/AddHoldingSheet";
import EditHoldingSheet from "@/components/client/portfolio/self/EditHoldingSheet";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import { usePortfolioTotals } from "@/hooks/usePortfolioTotals";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { useClientHoldings } from "@/hooks/useClientHoldings";
import { useClientTrack } from "@/hooks/useClientTrack";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import type { ClientHolding } from "@/hooks/useClientHoldings";
import { Link } from "wouter";

export default function ClientPortfolio() {
  const { profile, update } = useProfile();
  const { isTrackA, isTrackB } = useClientTrack();
  const { plans } = useAdvisedPlans();
  const { holdings, addHolding, updateHolding, deleteHolding } = useClientHoldings();
  const totals = usePortfolioTotals();

  const [activeTab, setActiveTab] = useState<"managed" | "other">("managed");
  const [addOpen, setAddOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<ClientHolding | null>(null);

  const displayCurrency = profile?.preferredCurrency ?? "USD";
  const toggleCurrency = () => {
    update.mutate({ preferredCurrency: displayCurrency === "USD" ? "VND" : "USD" });
  };

  async function handleAdd(data: Record<string, unknown>) {
    await addHolding(data as any);
    toast.success("Investment added ✓");
  }

  async function handleUpdate(id: string, data: Record<string, unknown>) {
    await updateHolding(id, data as any);
    toast.success("Investment updated ✓");
  }

  async function handleDelete(id: string) {
    await deleteHolding(id);
    toast.success("Holding removed.");
  }

  const managedTotal = totals.allHoldings.filter(h => h.isAdvisedPlan).reduce((sum, h) => sum + h.currentValue, 0);
  const otherTotal = totals.allHoldings.filter(h => !h.isAdvisedPlan).reduce((sum, h) => sum + h.currentValue, 0);
  const totalValue = managedTotal + otherTotal;
  const managedPct = totalValue > 0 ? (managedTotal / totalValue) * 100 : 0;
  const otherPct = totalValue > 0 ? (otherTotal / totalValue) * 100 : 0;

  return (
    <ClientAppShell>
      <div className="max-w-[900px] mx-auto">
        <div className="flex items-center justify-between mb-4.5">
          <h1 className="font-display text-[22px] font-bold text-[#042C53] tracking-[-0.02em]">Accounts</h1>
          <button
            onClick={toggleCurrency}
            className="shrink-0 min-h-[44px] px-3.5 rounded-full border border-[#E6E1D8] bg-white font-mono text-[11px] font-medium text-[#042C53] cursor-pointer hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
          >
            {displayCurrency}
          </button>
        </div>

        <div className="bg-white border border-[#E6E1D8] rounded-[24px] p-5 shadow-[0_4px_14px_rgba(4,44,83,.06)]">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B6459] mb-2">Everything tracked in tala</div>
          <div className="font-display text-[32px] font-bold text-[#042C53] tracking-[-0.03em] leading-none">
            <CurrencyDisplay amountUsd={totalValue} compact />
          </div>
          <div className="text-xs text-[#6B6459] mt-2">
            <CurrencyDisplay amountUsd={totalValue} currency={displayCurrency === "USD" ? "VND" : "USD"} compact showSign={false} /> · across {totals.allHoldings.length} accounts
          </div>
          
          <div className="flex h-2 rounded-full overflow-hidden mt-4 bg-[#F2EFE9]">
            {managedPct > 0 && <div style={{ width: `${managedPct}%` }} className="bg-[#1D9E75]" />}
            {otherPct > 0 && <div style={{ width: `${otherPct}%` }} className="bg-[#4A7CB8]" />}
          </div>
          
          <div className="flex gap-4 mt-2.5 text-[11px] text-[#6B6459]">
            {managedPct > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
                Advisor-managed {managedPct.toFixed(0)}%
              </span>
            )}
            {otherPct > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4A7CB8]" />
                Self-tracked {otherPct.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 bg-[#F2EFE9] rounded-full p-1 mt-4.5 mb-4">
          <button
            onClick={() => setActiveTab("managed")}
            className={`flex-1 min-h-[44px] border-none rounded-full font-sans text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === "managed" ? "bg-white text-[#042C53] shadow-sm" : "bg-transparent text-[#6B6459] hover:text-[#042C53]"
            }`}
          >
            Managed by your advisor
          </button>
          <button
            onClick={() => setActiveTab("other")}
            className={`flex-1 min-h-[44px] border-none rounded-full font-sans text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === "other" ? "bg-white text-[#042C53] shadow-sm" : "bg-transparent text-[#6B6459] hover:text-[#042C53]"
            }`}
          >
            Your other holdings
          </button>
        </div>

        {activeTab === "managed" ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold text-[#0F6E56] bg-[#E6F5EE] px-2.5 py-1.25 rounded-full">Advisor-managed</span>
              <span className="text-[11px] text-[#6B6459]">Return assumptions set by tala</span>
            </div>
            
            {plans.map(plan => (
              <div key={plan.id} className="bg-white border border-[#E6E1D8] rounded-[20px] p-4.5 mb-3">
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <div className="text-sm font-semibold text-[#042C53]">{plan.nickname || plan.productName || "Advised Plan"}</div>
                    <div className="text-[11px] text-[#6B6459] mt-1">{plan.providerName || "Utmost International"} · since {new Date(plan.createdAt).getFullYear()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-base font-bold text-[#042C53]">
                      <CurrencyDisplay amountUsd={parseFloat(plan.latestAccountValue || "0")} />
                    </div>
                    <div className="text-[11px] text-[#0F6E56] mt-1">+12.4% since inception</div>
                  </div>
                </div>
                <div className="h-px bg-[#F2EFE9] my-3.5" />
                <div className="flex justify-between text-[11px] text-[#6B6459]">
                  <span>Expected return (advisor)</span>
                  <span className="font-mono text-[#042C53]">7.4% p.a.</span>
                </div>
              </div>
            ))}
            
            {plans.length === 0 && (
              <div className="text-sm text-[#6B6459] text-center p-6 bg-white border border-[#E6E1D8] rounded-[20px]">
                No advisor-managed accounts found.
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#34567F] bg-[#E8EEF6] px-2.5 py-1.25 rounded-full">Self-tracked</span>
                <span className="text-[11px] text-[#6B6459]">You set the return assumption</span>
              </div>
              <button onClick={() => setAddOpen(true)} className="text-[11px] font-semibold text-[#1D9E75] hover:text-[#0F6E56]">
                + Add
              </button>
            </div>
            
            {holdings.map(h => {
              const dev = Math.abs((parseFloat(h.expectedAnnualReturnPct || "0") || 0) - 9.5);
              const deviates = dev >= 2;
              
              return (
                <div key={h.id} className="bg-white border border-[#E6E1D8] rounded-[20px] p-4.5 mb-3">
                  <div className="flex justify-between gap-3 items-start cursor-pointer" onClick={() => setEditHolding(h)}>
                    <div>
                      <div className="text-sm font-semibold text-[#042C53]">{h.label}</div>
                      <div className="text-[11px] text-[#6B6459] mt-1">{h.holdingType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-base font-bold text-[#042C53]">
                        <CurrencyDisplay amountUsd={h.currentValue} />
                      </div>
                      <div className="text-[11px] text-[#6B6459] mt-1">
                        <CurrencyDisplay amountUsd={h.currentValue} currency={displayCurrency === "USD" ? "VND" : "USD"} showSign={false} />
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-[#F2EFE9] my-3.5" />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-[#042C53]">Expected return</div>
                      <div className="text-[11px] text-[#6B6459] mt-0.5">Benchmark 9.5%</div>
                    </div>
                    <div className="flex items-center gap-1.5 border border-[#E6E1D8] rounded-xl px-2.5 h-11 bg-[#FAF8F5]">
                      <input
                        type="number"
                        step="0.1"
                        value={h.expectedAnnualReturnPct || ""}
                        onChange={(e) => updateHolding(h.id, { expectedAnnualReturnPct: e.target.value })}
                        placeholder="0.0"
                        className="w-[52px] border-none bg-transparent outline-none font-mono text-sm font-medium text-[#042C53] text-right"
                      />
                      <span className="font-mono text-xs text-[#6B6459]">%</span>
                    </div>
                  </div>
                  
                  {deviates && (
                    <div className="mt-3.5 bg-[#FEF3D6] border border-[#F0D79A] rounded-[14px] p-3 animate-in fade-in slide-in-from-top-2">
                      <div className="text-xs font-semibold text-[#8A5B12] mb-1">
                        {(parseFloat(h.expectedAnnualReturnPct || "0") > 9.5 ? "+" : "−")}{dev.toFixed(1)} points from the benchmark
                      </div>
                      <div className="text-[11px] leading-[1.5] text-[#7A5A25]">
                        At this rate, your projections may be overly optimistic. Your advisor can walk through it with you.
                      </div>
                      <Link href="/client/scenarios">
                        <button className="mt-2.5 min-h-[44px] px-3.5 border border-[#C8881C] rounded-xl bg-white text-[#8A5B12] font-sans text-xs font-semibold cursor-pointer hover:bg-[#FEF9EC] transition-colors">
                          Compare both trajectories
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
            
            {holdings.length === 0 && (
              <div className="text-sm text-[#6B6459] text-center p-6 bg-white border border-[#E6E1D8] rounded-[20px]">
                No self-tracked accounts added yet.
              </div>
            )}
          </div>
        )}
      </div>

      <AddHoldingSheet isOpen={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditHoldingSheet
        isOpen={!!editHolding}
        onClose={() => setEditHolding(null)}
        holding={editHolding}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </ClientAppShell>
  );
}
