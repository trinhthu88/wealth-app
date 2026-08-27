import SyncedItemBadge from "@/components/client/networth/SyncedItemBadge";
import type { InvestmentContribution } from "@/hooks/useClientBudget";
import { cn } from "@/lib/utils";

interface Props {
  contribution: InvestmentContribution;
  tone?: "green" | "clay";
  hint?: string;
}

function fmtUsd(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default function InvestmentContributionRow({ contribution, tone = "green", hint }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5 px-3 border rounded-xl",
        tone === "green" ? "bg-green-tint border-green/20" : "bg-clay-tint border-clay/20"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-forest truncate">{contribution.label}</p>
          <SyncedItemBadge />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-sm font-semibold text-forest">{fmtUsd(contribution.amount)}/mo</span>
        <span
          className="text-[10px] text-ink-30 cursor-help"
          title={hint ?? "Update this in Portfolio if your premium changes."}
        >
          ?
        </span>
      </div>
    </div>
  );
}
