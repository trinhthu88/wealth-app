import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

const CURRENCIES = ["USD", "VND", "EUR"] as const;

interface CurrencyToggleProps {
  className?: string;
}

export default function CurrencyToggle({ className }: CurrencyToggleProps) {
  const { profile, update } = useProfile();
  const active = profile?.preferredCurrency ?? "USD";

  return (
    <div className={cn("inline-flex items-center bg-surface rounded-full p-1", className)}>
      {CURRENCIES.map((c) => (
        <button
          key={c}
          onClick={() => update.mutate({ preferredCurrency: c })}
          className={cn(
            "h-9 px-3.5 text-[12px] font-semibold rounded-full transition-colors",
            active === c
              ? "bg-forest text-paper"
              : "text-forest hover:bg-forest/5"
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
