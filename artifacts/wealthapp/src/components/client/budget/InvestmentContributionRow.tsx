import { Lock } from "lucide-react";
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

function initials(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function InvestmentContributionRow({ contribution, tone = "green", hint }: Props) {
  return (
    <div className="flex items-center gap-3 p-3 min-h-[64px] border-b border-hairline last:border-0">
      <span
        className={cn(
          "w-10 h-10 rounded-[14px] flex-none flex items-center justify-center text-[12px] font-semibold",
          tone === "green" ? "bg-forest text-paper" : "bg-paper text-forest",
        )}
        aria-hidden="true"
      >
        {tone === "green" ? initials(contribution.label) : <Lock className="h-[18px] w-[18px]" />}
      </span>
      <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
        <p className="max-w-full text-[14px] font-medium text-forest truncate">{contribution.label}</p>
        <SyncedItemBadge />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[15px] font-semibold text-forest tabular-nums">{fmtUsd(contribution.amount)}/mo</span>
        <span
          className="h-6 w-6 flex items-center justify-center rounded-full bg-paper text-[11px] font-semibold text-ink-40 cursor-help"
          title={hint ?? "Update this in Portfolio if your premium changes."}
        >
          ?
        </span>
      </div>
    </div>
  );
}
