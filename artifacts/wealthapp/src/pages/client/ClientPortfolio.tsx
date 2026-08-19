// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: BottomSheet spring (add/edit holding sheets)
// ✓ ALLOWED: Donut chart draw animation (Recharts default)
// ✓ ALLOWED: Price refresh spinner while fetching
// ✗ BANNED:  Page-load stagger on any section or card
// ✗ BANNED:  Hero gradient card (no #042C53 → #0a4a8a background)
// ✗ BANNED:  Fake filters (no UI controls that don't actually filter)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import ClientAppShell from "@/components/client/AppShell";
import PortfolioHeader from "@/components/client/portfolio/PortfolioHeader";
import PortfolioTabs from "@/components/client/portfolio/PortfolioTabs";
import OverviewTab from "@/components/client/portfolio/tabs/OverviewTab";
import HoldingsTab from "@/components/client/portfolio/tabs/HoldingsTab";
import ActivityTab from "@/components/client/portfolio/tabs/ActivityTab";
import AddHoldingSheet from "@/components/client/portfolio/self/AddHoldingSheet";
import EditHoldingSheet from "@/components/client/portfolio/self/EditHoldingSheet";
import EmptyStateWithCTA from "@/components/client/EmptyStateWithCTA";
import TrackBConversionCTA from "@/components/client/TrackBConversionCTA";
import { usePortfolioTotals } from "@/hooks/usePortfolioTotals";
import { useAdvisedPlans } from "@/hooks/useAdvisedPlans";
import { useClientHoldings } from "@/hooks/useClientHoldings";
import { useClientTrack } from "@/hooks/useClientTrack";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import type { ClientHolding } from "@/hooks/useClientHoldings";

export default function ClientPortfolio() {
  const { profile } = useProfile();
  const { isTrackA, isTrackB } = useClientTrack();
  const { plans } = useAdvisedPlans();
  const { holdings, addHolding, updateHolding, deleteHolding } = useClientHoldings();
  const totals = usePortfolioTotals();
  const { data: advisor } = useQuery<{ id: string; fullName: string | null } | null>({
    queryKey: ["dashboard-advisor"],
    queryFn: () => apiFetch("/client/dashboard/advisor"),
  });
  const { data: packages = [] } = useQuery<Array<{ id: string }>>({
    queryKey: ["my-packages"],
    queryFn: () => apiFetch("/packages"),
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [addOpen, setAddOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<ClientHolding | null>(null);

  const displayCurrency = profile?.preferredCurrency ?? "USD";
  const isEmpty = plans.length === 0 && holdings.length === 0 && packages.length === 0;

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

  function handleEditFromHoldings(id: string) {
    const h = holdings.find(h => h.id === id);
    if (h) setEditHolding(h);
  }

  return (
    <ClientAppShell>
      <div className="max-w-[1100px] mx-auto space-y-5">
        <h1 className="text-xl font-bold text-[#042C53]">Investment accounts</h1>

        <PortfolioHeader totals={totals} loading={totals.loading} />

        {isEmpty && !totals.loading ? (
          <div className="space-y-4">
            <EmptyStateWithCTA
              icon={BarChart2}
              title="Your portfolio is empty"
              description="Add your first investment to start tracking your wealth in one place."
              action={{ label: "+ Add your first investment", onClick: () => setAddOpen(true) }}
            />
            <TrackBConversionCTA context="dashboard" />
          </div>
        ) : (
          <>
            <PortfolioTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "overview" && (
              <OverviewTab
                isTrackA={isTrackA}
                plans={plans}
                selfHoldings={holdings}
                totals={totals}
                displayCurrency={displayCurrency}
                advisorName={advisor?.fullName ?? undefined}
                onAddHolding={() => setAddOpen(true)}
                onEditHolding={setEditHolding}
              />
            )}

            {activeTab === "holdings" && (
              <HoldingsTab
                allHoldings={totals.allHoldings}
                displayCurrency={displayCurrency}
                onEdit={handleEditFromHoldings}
                onView={() => {}}
              />
            )}

            {activeTab === "activity" && (
              <ActivityTab plans={plans} selfHoldings={holdings} />
            )}
          </>
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
