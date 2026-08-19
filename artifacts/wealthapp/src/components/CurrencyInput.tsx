import { useId, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (v: number) => void;
  currency?: string;
  label?: string;
  placeholder?: string;
  className?: string;
}

export default function CurrencyInput({ value, onChange, currency = "USD", label, placeholder = "0", className }: Props) {
  const symbol = currency === "VND" ? "₫" : "$";
  const [focused, setFocused] = useState(false);
  const inputId = useId();

  const displayValue = focused
    ? (value === 0 ? "" : String(value))
    : (value === 0 ? "" : value.toLocaleString());

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label htmlFor={inputId} className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative flex items-center border-2 border-border rounded-xl bg-card focus-within:border-primary transition-colors">
        <span className="pl-4 text-2xl font-semibold text-muted-foreground select-none" aria-hidden="true">{symbol}</span>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={displayValue}
          placeholder={placeholder}
          aria-label={label ? undefined : `Amount in ${currency}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            onChange(raw === "" ? 0 : parseFloat(raw) || 0);
          }}
          className="flex-1 text-3xl font-bold text-center py-4 pr-4 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 w-full"
        />
      </div>
    </div>
  );
}
