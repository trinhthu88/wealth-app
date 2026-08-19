import { cn } from "@/lib/utils";
import { TrendingUp, Sprout } from "lucide-react";

interface Props {
  hasExistingInvestments: boolean | null;
  onChange: (v: boolean) => void;
}

export default function Phase2Screen3TrackB({ hasExistingInvestments, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Do you have any existing investments?</h1>
        <p className="text-sm text-slate-500">Outside of this platform — stocks, crypto, property, savings, anything.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Yes */}
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "flex flex-col items-start gap-3 p-5 rounded-2xl border-2 transition-all text-left",
            hasExistingInvestments === true
              ? "border-[#1D9E75] bg-[#1D9E75]/5"
              : "border-slate-200 hover:border-[#1D9E75]/40"
          )}
        >
          <TrendingUp className="w-8 h-8 text-[#1D9E75]" />
          <div>
            <p className="font-semibold text-[#042C53] text-sm">Yes, I have investments</p>
            <p className="text-xs text-slate-500 mt-0.5">I'll add them now</p>
          </div>
        </button>

        {/* No */}
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "flex flex-col items-start gap-3 p-5 rounded-2xl border-2 transition-all text-left",
            hasExistingInvestments === false
              ? "border-[#1D9E75] bg-[#1D9E75]/5"
              : "border-slate-200 hover:border-[#1D9E75]/40"
          )}
        >
          <Sprout className="w-8 h-8 text-[#1D9E75]" />
          <div>
            <p className="font-semibold text-[#042C53] text-sm">Not yet — I'm starting fresh</p>
            <p className="text-xs text-slate-500 mt-0.5">Let's build from here</p>
          </div>
        </button>
      </div>
    </div>
  );
}
