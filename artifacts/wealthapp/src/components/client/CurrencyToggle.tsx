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
    <div className={cn("inline-flex items-center bg-slate-100 rounded-lg p-0.5", className)}>
      {CURRENCIES.map((c) => (
        <button
          key={c}
          onClick={() => update.mutate({ preferredCurrency: c })}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            active === c
              ? "bg-white text-[#042C53] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
