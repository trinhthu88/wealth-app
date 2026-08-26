import ClientAppShell from "@/components/client/AppShell";
import WealthScoreCard from "@/components/client/dashboard/WealthScoreCard";

export default function ClientHealthScore() {
  return (
    <ClientAppShell>
      <div className="space-y-[14px]">
        <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em] mb-[14px]">
          Wealth Score
        </h1>
        <WealthScoreCard />
      </div>
    </ClientAppShell>
  );
}
