import { useId, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { convertCurrency, formatCurrency } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";

interface CurrencyFieldProps {
  /** Editable input mode (was CurrencyInput). Defaults to read-only display (was CurrencyDisplay). */
  editable?: boolean;

  // ── Read-only mode ──────────────────────────────────────────────────────
  /** USD-denominated amount to convert and display in the user's preferred currency. */
  amountUsd?: number;
  compact?: boolean;
  showSign?: boolean;

  // ── Editable mode ────────────────────────────────────────────────────────
  /** Raw amount in `currency` — no conversion happens while editing. */
  value?: number;
  onChange?: (v: number) => void;
  label?: string;
  placeholder?: string;

  // ── Shared ───────────────────────────────────────────────────────────────
  currency?: string;
  className?: string;
}

/**
 * Read-only mode reuses the same convertCurrency/formatCurrency pipeline that
 * was CurrencyDisplay's — already wired to the user's preferred_currency, so
 * every caller of this component gets real multi-currency display, not just
 * the ones that used to import CurrencyDisplay directly.
 */
export default function CurrencyField({
  editable = false,
  amountUsd = 0,
  compact = false,
  showSign = false,
  value = 0,
  onChange,
  label,
  placeholder = "0",
  currency,
  className,
}: CurrencyFieldProps) {
  const { profile } = useProfile();
  const { rates } = useCurrencyRates();
  const [focused, setFocused] = useState(false);
  const inputId = useId();

  if (editable) {
    const displayCurrency = currency ?? "USD";
    const symbol = displayCurrency === "VND" ? "₫" : displayCurrency === "EUR" ? "€" : "$";
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
            aria-label={label ? undefined : `Amount in ${displayCurrency}`}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "");
              onChange?.(raw === "" ? 0 : parseFloat(raw) || 0);
            }}
            className="flex-1 text-3xl font-bold text-center py-4 pr-4 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 w-full"
          />
        </div>
      </div>
    );
  }

  const displayCurrency = currency ?? profile?.preferredCurrency ?? "USD";
  const converted = convertCurrency(amountUsd, "USD", displayCurrency, rates);
  const formatted = formatCurrency(Math.abs(converted), displayCurrency, compact);
  const sign = showSign ? (converted >= 0 ? "+" : "-") : converted < 0 ? "-" : "";
  const isUsdEquivalent = displayCurrency !== "USD";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>
        {sign}
        {formatted}
      </span>
      {isUsdEquivalent && (
        <span className="text-xs text-ink-30 cursor-help" title="USD equivalent">
          ≈
        </span>
      )}
    </span>
  );
}
