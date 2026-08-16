import SyncedItemBadge from "@/components/client/networth/SyncedItemBadge";
import type { InvestmentContribution } from "@/hooks/useClientBudget";

interface Props {
  contribution: InvestmentContribution;
}

function fmtUsd(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default function InvestmentContributionRow({ contribution }: Props) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-[#F0FDF8] border border-[#1D9E75]/20 rounded-xl">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#042C53] truncate">{contribution.label}</p>
          <SyncedItemBadge />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-sm font-semibold text-[#042C53]">{fmtUsd(contribution.amount)}/mo</span>
        <span
          className="text-[10px] text-slate-400 cursor-help"
          title="Update this in Portfolio if your premium changes."
        >
          ?
        </span>
      </div>
    </div>
  );
}
