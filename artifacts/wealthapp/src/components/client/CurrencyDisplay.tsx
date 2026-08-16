import { useProfile } from "@/hooks/useProfile";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { convertCurrency, formatCurrency } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amountUsd: number;
  currency?: string;
  compact?: boolean;
  showSign?: boolean;
  className?: string;
}

export default function CurrencyDisplay({
  amountUsd,
  currency,
  compact = false,
  showSign = false,
  className,
}: CurrencyDisplayProps) {
  const { profile } = useProfile();
  const { rates } = useCurrencyRates();

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
        <span
          className="text-xs text-slate-400 cursor-help"
          title="USD equivalent"
        >
          ≈
        </span>
      )}
    </span>
  );
}
