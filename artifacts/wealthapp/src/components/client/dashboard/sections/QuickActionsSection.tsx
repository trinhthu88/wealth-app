import { Link } from "wouter";

interface Props {
  isTrackA: boolean;
  advisorName: string | null;
}

export default function QuickActionsSection({ isTrackA, advisorName }: Props) {
  const name = advisorName || "Minh Anh";
  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="mt-3.5 space-y-3.5">
      {isTrackA && (
        <div className="flex items-center gap-3.5 bg-surface rounded-[24px] p-3.5">
          <div className="w-11 h-11 shrink-0 rounded-full bg-field text-forest flex items-center justify-center text-[14px] font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-forest truncate">{name}</div>
            <div className="text-[11px] text-ink-40 truncate">Your advisor · replies within a day</div>
          </div>
          <Link href="/client/advisor/messages">
            <button className="min-h-[44px] px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest font-sans text-[13px] font-semibold cursor-pointer hover:bg-forest/5 transition-colors">
              Message
            </button>
          </Link>
        </div>
      )}

      <Link href="/client/onboarding">
        <button className="w-full min-h-[44px] bg-transparent border border-dashed border-hairline rounded-full text-ink-40 text-[13px] font-semibold cursor-pointer hover:border-forest hover:text-forest transition-colors">
          Replay onboarding
        </button>
      </Link>
    </div>
  );
}
