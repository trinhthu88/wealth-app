import { useState } from "react";
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

  const displayValue = focused
    ? (value === 0 ? "" : String(value))
    : (value === 0 ? "" : value.toLocaleString());

  return (
    <div className={cn("space-y-2", className)}>
      {label && <div className="text-sm font-medium text-foreground">{label}</div>}
      <div className="relative flex items-center border-2 border-border rounded-xl bg-card focus-within:border-primary transition-colors">
        <span className="pl-4 text-2xl font-semibold text-muted-foreground select-none">{symbol}</span>
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          placeholder={placeholder}
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
