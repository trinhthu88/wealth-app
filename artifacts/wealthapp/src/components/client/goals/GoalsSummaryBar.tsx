import { Target, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  totalActive: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
}

export default function GoalsSummaryBar({ totalActive, onTrack, atRisk, offTrack }: Props) {
  const allOnTrack = totalActive > 0 && onTrack === totalActive;

  if (totalActive === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#1D9E75]/10 text-[#1D9E75]">
        <Target className="h-3.5 w-3.5" />
        {totalActive} active {totalActive === 1 ? "goal" : "goals"}
      </span>

      {allOnTrack ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All on track
        </span>
      ) : (
        <>
          {onTrack > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {onTrack} on track
            </span>
          )}
          {atRisk > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {atRisk} at risk
            </span>
          )}
          {offTrack > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
              <XCircle className="h-3.5 w-3.5" />
              {offTrack} off track
            </span>
          )}
        </>
      )}
    </div>
  );
}
