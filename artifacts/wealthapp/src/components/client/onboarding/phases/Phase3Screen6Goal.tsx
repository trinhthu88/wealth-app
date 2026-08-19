import { cn } from "@/lib/utils";
import { Palmtree, Home, GraduationCap, Rocket, Briefcase, Globe, Coins, Shield } from "lucide-react";

const GOAL_TYPES = [
  { id: "retire",     icon: Palmtree, label: "Retire comfortably",      defaultName: "Comfortable retirement" },
  { id: "property",   icon: Home, label: "Buy property",             defaultName: "Buy my home" },
  { id: "education",  icon: GraduationCap, label: "Children's education",     defaultName: "Children's education fund" },
  { id: "fire",       icon: Rocket, label: "Financial independence",   defaultName: "Financial independence" },
  { id: "business",   icon: Briefcase, label: "Build a business",         defaultName: "Build my business" },
  { id: "emigrate",   icon: Globe, label: "Emigrate",                 defaultName: "Emigration fund" },
  { id: "wealth",     icon: Coins, label: "Wealth preservation",      defaultName: "Wealth preservation" },
  { id: "emergency",  icon: Shield,  label: "Emergency fund",           defaultName: "Emergency fund" },
];

const CURRENCIES = ["USD", "VND", "EUR"] as const;

export interface Screen6Data {
  goalType: string;
  goalName: string;
  goalTargetAmount: string;
  goalCurrency: string;
  goalTargetDate: string;
}

interface Props {
  data: Screen6Data;
  preferredCurrency: string;
  onChange: (updates: Partial<Screen6Data>) => void;
}

function getMinDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 7);
}

export default function Phase3Screen6Goal({ data, preferredCurrency, onChange }: Props) {
  const minDate = getMinDate();

  function selectType(id: string) {
    const gt = GOAL_TYPES.find(g => g.id === id)!;
    onChange({
      goalType: id,
      goalName: data.goalName || gt.defaultName,
      goalCurrency: data.goalCurrency || preferredCurrency,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Your #1 financial goal</h1>
        <p className="text-sm text-slate-500">What are you working towards? You can add more goals later.</p>
      </div>

      {/* Goal type grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {GOAL_TYPES.map(gt => (
          <button
            key={gt.id}
            type="button"
            onClick={() => selectType(gt.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all",
              data.goalType === gt.id
                ? "border-[#1D9E75] bg-[#1D9E75]/5"
                : "border-slate-200 hover:border-[#1D9E75]/30"
            )}
          >
            <gt.icon className={cn("w-5 h-5 shrink-0", data.goalType === gt.id ? "text-[#1D9E75]" : "text-slate-600")} />
            <span className="text-sm font-medium text-[#042C53] leading-tight">{gt.label}</span>
          </button>
        ))}
      </div>

      {/* Details expansion */}
      {data.goalType && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          {/* Goal name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#042C53]">Goal name</label>
            <input
              type="text"
              value={data.goalName}
              onChange={e => onChange({ goalName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
            />
          </div>

          {/* Target amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#042C53]">
              Target amount <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={data.goalTargetAmount}
                onChange={e => onChange({ goalTargetAmount: e.target.value })}
                placeholder="0"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
              />
              <select
                value={data.goalCurrency}
                onChange={e => onChange({ goalCurrency: e.target.value })}
                className="px-3 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] bg-white focus:outline-none"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-400">How much do you need to reach this goal?</p>
          </div>

          {/* Target date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#042C53]">
              Target date <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="month"
              min={minDate}
              value={data.goalTargetDate}
              onChange={e => onChange({ goalTargetDate: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
