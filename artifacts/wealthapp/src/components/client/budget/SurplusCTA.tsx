import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Link } from "wouter";
import { useClientTrack } from "@/hooks/useClientTrack";
import { projectMonthlyGrowth } from "@/lib/investmentCalculations";

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
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1D9E75]/5 border-l-[3px] border-[#1D9E75]">
      <Sparkles className="h-4 w-4 text-[#1D9E75] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[13px] font-semibold text-[#042C53]">
          You have {fmtCompact(surplus)} surplus this month
        </p>
        {isTrackA ? (
          <p className="text-xs text-slate-600">
            Run a scenario to see what investing your {fmtCompact(surplus)}/month surplus could do.{" "}
            <Link
              href={`/client/scenarios?type=increase_monthly&surplus=${Math.round(surplus)}`}
              className="text-[#1D9E75] font-medium hover:underline"
            >
              Model my surplus →
            </Link>
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              Investing {fmtCompact(surplus)}/month could grow to{" "}
              <span className="font-semibold text-[#042C53]">{fmtCompact(tenYearValue)}</span>{" "}
              over 10 years at 7%.{" "}
              <Link
                href={`/client/scenarios?type=increase_monthly&surplus=${Math.round(surplus)}`}
                className="text-[#1D9E75] font-medium hover:underline"
              >
                Run the numbers →
              </Link>
            </p>
            <p className="text-xs text-slate-500">
              Want a personalized investment plan?{" "}
              <Link href="/client/messages" className="text-[#1D9E75] font-medium hover:underline">
                Talk to an advisor →
              </Link>
            </p>
          </>
        )}
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem(`surplus_cta_dismissed_${monthKey}`, "1");
        }}
        className="shrink-0 h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
