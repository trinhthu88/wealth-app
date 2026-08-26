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

  return (
    <div className="bg-sun-tint rounded-[24px] p-[16px_18px] mb-[14px] flex gap-3 items-start relative pr-10">
      <div className="shrink-0 mt-1">
        <Sol size="sm" animate="idle" showRays={false} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-amber-ink leading-[1.5] text-pretty">
          {isTrackA ? (
            <>
              You have {fmtCompact(surplus)} surplus this month. Want me to run a scenario to see what investing it could do?{" "}
              <Link
                href={`/client/scenarios?type=increase_monthly&surplus=${Math.round(surplus)}`}
                className="font-semibold underline decoration-amber-ink/30 hover:decoration-amber-ink"
              >
                Model my surplus
              </Link>
            </>
          ) : (
            <>
              Investing your {fmtCompact(surplus)} surplus could grow to <span className="font-semibold">{fmtCompact(tenYearValue)}</span> over 10 years.{" "}
              <Link
                href={`/client/scenarios?type=increase_monthly&surplus=${Math.round(surplus)}`}
                className="font-semibold underline decoration-amber-ink/30 hover:decoration-amber-ink"
              >
                Run the numbers
              </Link>
              {" "}or{" "}
              <Link href="/client/messages" className="font-semibold underline decoration-amber-ink/30 hover:decoration-amber-ink">
                talk to an advisor
              </Link>.
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem(`surplus_cta_dismissed_${monthKey}`, "1");
        }}
        className="absolute top-[16px] right-[16px] h-6 w-6 flex items-center justify-center rounded-full text-amber-ink/50 hover:bg-sun-deep/10 hover:text-amber-ink transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
