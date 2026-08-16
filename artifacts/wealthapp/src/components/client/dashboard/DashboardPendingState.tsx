import { Link } from "wouter";
import { Hourglass, TrendingUp, Target, MessageSquare } from "lucide-react";

interface Props {
  advisorName?: string | null;
}

export default function DashboardPendingState({ advisorName }: Props) {
  return (
    <div className="max-w-[560px] mx-auto">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-[#1D9E75]/10 flex items-center justify-center">
            <Hourglass className="h-6 w-6 text-[#1D9E75]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#042C53]">Your portfolio is being prepared</h2>
            <p className="text-sm text-[#64748B] mt-1">
              {advisorName ? `${advisorName} is setting up your investment plan.` : "Your advisor is setting up your investment plan."}
              {" "}This usually takes less than 24 hours.
            </p>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">What happens next</p>
          {[
            { done: true,  label: "Your advisor has been assigned" },
            { done: false, label: "Your advisor enters your plan details" },
            { done: false, label: "Your portfolio appears here" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${step.done ? "bg-[#1D9E75] text-white" : "border-2 border-slate-200"}`}>
                {step.done ? "✓" : ""}
              </div>
              <span className={`text-sm ${step.done ? "text-[#042C53] font-medium" : "text-[#64748B]"}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">While you wait, you can:</p>
          {[
            { icon: TrendingUp, label: "Add your other investments", href: "/client/portfolio" },
            { icon: Target,     label: "Set a financial goal",       href: "/client/goals" },
            { icon: MessageSquare, label: "Message your advisor",   href: "/client/messages" },
          ].map(({ icon: Icon, label, href }) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-2 text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56] cursor-pointer">
                <Icon className="h-4 w-4 shrink-0" />
                {label} →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
