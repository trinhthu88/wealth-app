import { Link } from "wouter";
import { MessageSquare } from "lucide-react";

interface Props {
  advisorName: string | null;
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function PlanHeader({ advisorName }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-[#042C53]">Your Financial Plan</h1>
        {advisorName && (
          <p className="text-sm text-slate-400 mt-0.5">Created by {advisorName}</p>
        )}
      </div>

      {advisorName && (
        <div className="inline-flex items-center gap-3 bg-white border border-[#E2E8F0] rounded-xl px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-[#1D9E75]/20 text-[#1D9E75] flex items-center justify-center font-semibold text-sm shrink-0">
            {initials(advisorName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#042C53]">{advisorName}</p>
            <p className="text-xs text-slate-400">Financial Advisor</p>
          </div>
          <Link
            href="/client/messages"
            className="flex items-center gap-1.5 text-sm text-[#1D9E75] font-medium hover:text-[#0F6E56] ml-2 whitespace-nowrap"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message →
          </Link>
        </div>
      )}
    </div>
  );
}
