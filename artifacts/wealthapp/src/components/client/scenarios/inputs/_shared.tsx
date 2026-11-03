import { cn } from "@/lib/utils";

export const RETURN_DEFAULT = 7.0;
export const HORIZON_DEFAULTS = [5, 10, 15, 20];

export function HorizonSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const presets = [5, 10, 15, 20];
  const isCustom = !presets.includes(value);

  return (
    <div className="space-y-1.5">
      <label className="text-[14px] font-medium text-paper">Project over</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(y => (
          <button
            key={y}
            onClick={() => onChange(y)}
            className={cn(
              "min-h-[44px] px-4 rounded-full text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-field",
              value === y && !isCustom ? "bg-field text-forest" : "bg-white/10 text-paper hover:bg-white/20"
            )}
          >
            {y}yr
          </button>
        ))}
        <button
          onClick={() => onChange(isCustom ? value : 12)}
          className={cn(
            "min-h-[44px] px-4 rounded-full text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-field",
            isCustom ? "bg-field text-forest" : "bg-white/10 text-paper hover:bg-white/20"
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
              className="w-16 h-11 px-2 rounded-[14px] bg-white/10 text-[15px] font-semibold tabular-nums text-center text-field focus:outline-none focus:ring-2 focus:ring-field"
            />
            <span className="text-[14px] text-mint">yr</span>
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
        <label className="text-[14px] font-medium text-paper">Assumed annual return</label>
        <span className="font-display tabular-nums text-[32px] leading-none text-field">{value.toFixed(1)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={15}
        step={0.5}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-8 accent-field cursor-pointer"
      />
      <p className="text-[12px] text-mint">Adjust based on your investment strategy. Past performance ≠ future results.</p>
    </div>
  );
}

export function SourceDisplay({ label, currentValue, currentMonthly, currency = "USD" }: {
  label: string; currentValue: number; currentMonthly: number; currency?: string;
}) {
  const fmt = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  return (
    <div className="bg-white/10 rounded-[14px] p-3 space-y-1">
      <p className="tala-eyebrow text-mint">{label}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
        <div>
          <span className="text-mint">Value: </span>
          <span className="font-semibold tabular-nums text-paper">{fmt(currentValue)}</span>
        </div>
        {currentMonthly > 0 && (
          <div>
            <span className="text-mint">Monthly: </span>
            <span className="font-semibold tabular-nums text-paper">{fmt(currentMonthly)}/mo</span>
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
      className="w-full h-12 px-5 rounded-full bg-field text-forest font-semibold text-[15px] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-paper"
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
      <label className="text-[14px] font-medium text-paper">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          min={min}
          max={max}
          style={{ MozAppearance: "textfield" } as React.CSSProperties}
          className="flex-1 min-w-0 h-12 px-4 rounded-[14px] bg-white/10 text-[18px] font-semibold tabular-nums text-field placeholder:text-mint/60 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-field [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {suffix && <span className="text-[14px] text-mint shrink-0">{suffix}</span>}
      </div>
      {helper && <p className="text-[12px] text-mint">{helper}</p>}
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
      {label && <label className="text-[14px] font-medium text-paper">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-[44px] px-4 rounded-full text-[14px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-field",
              value === opt.value ? "bg-field text-forest" : "bg-white/10 text-paper hover:bg-white/20"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
