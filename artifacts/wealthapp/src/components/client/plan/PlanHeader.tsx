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
        <h1 className="font-display text-[34px] leading-[1.05] text-forest">Your Financial Plan</h1>
        {advisorName && (
          <p className="text-[14px] text-ink-40 mt-1">Created by {advisorName}</p>
        )}
      </div>

      {advisorName && (
        <div className="inline-flex items-center gap-3 bg-surface rounded-[24px] p-3 pr-4">
          <div className="h-11 w-11 rounded-[14px] bg-field text-forest flex items-center justify-center font-semibold text-[14px] shrink-0">
            {initials(advisorName)}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-forest">{advisorName}</p>
            <p className="text-[12px] text-ink-40">Financial Advisor</p>
          </div>
          <Link
            href="/client/advisor/messages"
            className="flex items-center gap-1.5 h-11 px-4 rounded-full bg-forest text-paper text-[14px] font-semibold hover:bg-forest-700 ml-2 whitespace-nowrap transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message →
          </Link>
        </div>
      )}
    </div>
  );
}
