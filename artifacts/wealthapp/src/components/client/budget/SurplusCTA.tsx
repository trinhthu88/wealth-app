import { useState } from "react";
import { X } from "lucide-react";
import { Link } from "wouter";
import { useClientTrack } from "@/hooks/useClientTrack";
import Sol from "@/components/Sol";
import CheckpointCard from "@/components/client/CheckpointCard";

function fmtCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

interface Props {
  surplus: number;
  monthKey: string;
}

export default function SurplusCTA({ surplus, monthKey }: Props) {
  const { isTrackA, loading } = useClientTrack();
  if (loading || surplus <= 0) return null;
  // Track A is past this checkpoint: for them this is a modelling shortcut, not an offer.
  return isTrackA ? <ModelSurplus surplus={surplus} monthKey={monthKey} /> : <CheckpointCard codes={["C4_surplus"]} />;
}

function ModelSurplus({ surplus, monthKey }: Props) {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(`surplus_cta_dismissed_${monthKey}`) === "1"
  );
  if (dismissed) return null;

  return (
    <section
      aria-label="Surplus"
      className="bg-field rounded-[24px] p-4 pr-12 flex gap-3 items-center relative"
    >
      <div className="shrink-0">
        <Sol size="sm" animate="idle" showRays={false} />
      </div>
      <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="flex-1 min-w-[180px] text-[14px] text-forest leading-[1.45] text-pretty">
              You have <span className="font-semibold">{fmtCompact(surplus)}</span> surplus this month. Want me to run a scenario to see what investing it could do?
            </p>
            <Link
              href={`/client/goals/what-if?type=increase_monthly&surplus=${Math.round(surplus)}`}
              className="inline-flex h-10 items-center rounded-full bg-forest px-3.5 text-[13px] font-semibold text-paper whitespace-nowrap hover:bg-forest-700"
            >
              Model my surplus
            </Link>
          </div>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem(`surplus_cta_dismissed_${monthKey}`, "1");
        }}
        className="absolute top-2 right-2 h-9 w-9 flex items-center justify-center rounded-full text-forest/60 hover:bg-forest/10 hover:text-forest transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
