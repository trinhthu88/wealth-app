import { useState } from "react";
import { X } from "lucide-react";
import { Link } from "wouter";
import { useClientTrack } from "@/hooks/useClientTrack";
import { projectMonthlyGrowth } from "@/lib/investmentCalculations";
import Sol from "@/components/Sol";

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
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem(`surplus_cta_dismissed_${monthKey}`) === "1"
  );

  if (loading || surplus <= 0 || dismissed) return null;

  // 10-year projection at 7%
  const projected = projectMonthlyGrowth(0, surplus, 7.0, 120);
  const tenYearValue = projected[projected.length - 1].value;

  const linkInline = "font-semibold text-forest underline decoration-forest/30 underline-offset-2 hover:decoration-forest";

  return (
    <section
      aria-label="Surplus"
      className="bg-field rounded-[24px] p-4 pr-12 flex gap-3 items-center relative"
    >
      <div className="shrink-0">
        <Sol size="sm" animate="idle" showRays={false} />
      </div>
      <div className="flex-1 min-w-0">
        {isTrackA ? (
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
        ) : (
          <p className="text-[14px] text-forest leading-[1.45] text-pretty">
            Investing your {fmtCompact(surplus)} surplus could grow to <span className="font-semibold">{fmtCompact(tenYearValue)}</span> over 10 years.{" "}
            <Link
              href={`/client/goals/what-if?type=increase_monthly&surplus=${Math.round(surplus)}`}
              className={linkInline}
            >
              Run the numbers
            </Link>
            {" "}or{" "}
            <Link href="/client/advisor/messages" className={linkInline}>
              talk to an advisor
            </Link>.
          </p>
        )}
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
