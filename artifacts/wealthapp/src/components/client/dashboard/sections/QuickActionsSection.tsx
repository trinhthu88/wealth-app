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
        <div className="flex items-center gap-3.5 bg-white border border-[#E3E9FD] rounded-[20px] p-3.5 shadow-sm">
          <div className="w-11 h-11 shrink-0 rounded-full bg-[#E3E9FD] text-[#08167A] flex items-center justify-center font-display font-bold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#0C21A4] truncate">{name}</div>
            <div className="text-[11px] text-[#4A5590] truncate">Your advisor · replies within a day</div>
          </div>
          <Link href="/client/advisor/messages">
            <button className="min-h-[44px] px-4 rounded-full border border-[#0C21A4] bg-white text-[#0C21A4] font-sans text-[13px] font-semibold cursor-pointer hover:bg-[#E3E9FD] transition-colors">
              Message
            </button>
          </Link>
        </div>
      )}

      <Link href="/client/onboarding">
        <button className="w-full min-h-[44px] bg-transparent border border-dashed border-[#E3E9FD] rounded-[16px] text-[#4A5590] font-mono text-[10px] tracking-[0.12em] uppercase cursor-pointer hover:border-[#0C21A4] hover:text-[#0C21A4] transition-colors">
          Replay onboarding
        </button>
      </Link>
    </div>
  );
}
