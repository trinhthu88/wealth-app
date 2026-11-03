import { Target, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  totalActive: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
}

const PILL = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold";

export default function GoalsSummaryBar({ totalActive, onTrack, atRisk, offTrack }: Props) {
  const allOnTrack = totalActive > 0 && onTrack === totalActive;

  if (totalActive === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <span className={`${PILL} bg-surface text-forest`}>
        <Target className="h-3.5 w-3.5" />
        {totalActive} active {totalActive === 1 ? "goal" : "goals"}
      </span>

      {allOnTrack ? (
        <span className={`${PILL} bg-forest text-paper`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          All on track
        </span>
      ) : (
        <>
          {onTrack > 0 && (
            <span className={`${PILL} bg-forest text-paper`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {onTrack} on track
            </span>
          )}
          {atRisk > 0 && (
            <span className={`${PILL} bg-sun text-forest`}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {atRisk} at risk
            </span>
          )}
          {offTrack > 0 && (
            <span className={`${PILL} bg-sun text-forest`}>
              <XCircle className="h-3.5 w-3.5" />
              {offTrack} off track
            </span>
          )}
        </>
      )}
    </div>
  );
}
