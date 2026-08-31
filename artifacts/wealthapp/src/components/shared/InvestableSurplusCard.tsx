import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  surplus: number;
  currency?: string;
  className?: string;
}

function fmt(n: number, currency: string) {
  const sym = currency === "VND" ? "₫" : "$";
  return `${sym}${Math.round(Math.abs(n)).toLocaleString()}`;
}

export default function InvestableSurplusCard({ surplus, currency = "USD", className }: Props) {
  const r = 0.07 / 12;
  const n = 120;
  const projectedValue = surplus > 0 ? surplus * ((Math.pow(1 + r, n) - 1) / r) : 0;

  return (
    <div className={cn("bg-surface rounded-2xl border border-hairline p-5", className)}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-[18px] w-[18px] text-green" />
        <h3 className="font-semibold text-forest text-[15px]">Your investable surplus</h3>
      </div>

      {surplus > 0 ? (
        <>
          <p className="text-[26px] font-bold text-green">
            {fmt(surplus, currency)}<span className="text-[13px] font-normal text-ink-40"> / month</span>
          </p>
          <div className="mt-3.5 bg-green-tint rounded-xl p-4">
            <p className="text-[13px] text-forest font-medium">If invested at 7% annually over 10 years, this becomes:</p>
            <p className="text-[20px] font-bold text-green mt-1">{fmt(projectedValue, currency)}</p>
            <p className="text-[11px] text-ink-40 mt-1">Compound growth projection · assumes a consistent monthly contribution</p>
          </div>
          <a
            href="/book"
            className="mt-4 flex items-center justify-center w-full rounded-xl bg-green text-white text-[13px] font-semibold py-3 hover:bg-forest-700 transition-colors"
          >
            Start a regular savings plan with an advisor →
          </a>
        </>
      ) : (
        <div className="text-center py-2">
          <p className="text-ink-40 text-[13px]">
            {surplus === 0
              ? "Your income covers your expenses exactly. Find ways to reduce spending to unlock a surplus."
              : `You're spending ${fmt(surplus, currency)} more than you earn. Let's fix your budget first.`}
          </p>
        </div>
      )}
    </div>
  );
}
