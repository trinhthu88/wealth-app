import { cn } from "@/lib/utils";

export const RETURN_DEFAULT = 7.0;
export const HORIZON_DEFAULTS = [5, 10, 15, 20];

export function HorizonSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const presets = [5, 10, 15, 20];
  const isCustom = !presets.includes(value);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#042C53]">Project over</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(y => (
          <button
            key={y}
            onClick={() => onChange(y)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
              value === y && !isCustom ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]" : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/40"
            )}
          >
            {y}yr
          </button>
        ))}
        <button
          onClick={() => onChange(isCustom ? value : 12)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
            isCustom ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]" : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/40"
          )}
        >
          Custom
        </button>
        {isCustom && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={value}
              min={1}
              max={40}
              onChange={e => onChange(parseInt(e.target.value) || 10)}
              className="w-16 px-2 py-1.5 rounded-lg border border-[#1D9E75] text-sm text-center text-[#042C53] focus:outline-none"
            />
            <span className="text-sm text-slate-500">yr</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReturnSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#042C53]">Assumed annual return</label>
        <span className="text-sm font-semibold text-[#1D9E75]">{value.toFixed(1)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={15}
        step={0.5}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#1D9E75]"
      />
      <p className="text-xs text-slate-400">Adjust based on your investment strategy. Past performance ≠ future results.</p>
    </div>
  );
}

export function SourceDisplay({ label, currentValue, currentMonthly, currency = "USD" }: {
  label: string; currentValue: number; currentMonthly: number; currency?: string;
}) {
  const fmt = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">{label}</p>
      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-slate-400">Value: </span>
          <span className="font-semibold text-[#042C53]">{fmt(currentValue)}</span>
        </div>
        {currentMonthly > 0 && (
          <div>
            <span className="text-slate-400">Monthly: </span>
            <span className="font-semibold text-[#042C53]">{fmt(currentMonthly)}/mo</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RunButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      Run scenario
    </button>
  );
}

export function NumberInput({ value, onChange, label, placeholder, min, max, suffix, helper }: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string;
  min?: number; max?: number; suffix?: string; helper?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#042C53]">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          min={min}
          max={max}
          style={{ MozAppearance: "textfield" } as React.CSSProperties}
          className="flex-1 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && <span className="text-sm text-slate-500 shrink-0">{suffix}</span>}
      </div>
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

export function SegmentedPicker<T extends string | number>({ options, value, onChange, label }: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (v: T & (string | number)) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-[#042C53]">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
              value === opt.value ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]" : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/40"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
