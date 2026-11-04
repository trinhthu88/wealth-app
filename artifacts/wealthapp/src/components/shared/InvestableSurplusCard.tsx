import { TrendingUp, ArrowUpRight } from "lucide-react";
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

  if (surplus <= 0) {
    const over = surplus < 0;
    return (
      <section
        aria-label="Investable surplus"
        className={cn("rounded-[24px] p-5", over ? "bg-sun-tint" : "bg-surface", className)}
      >
        <p className={cn("tala-eyebrow", over ? "text-amber-ink" : "text-ink-40")}>Investable surplus</p>
        <p className={cn("mt-1.5 text-[14px] leading-[1.5] text-pretty", over ? "text-amber-ink" : "text-ink-40")}>
          {over
            ? `You're spending ${fmt(surplus, currency)} more than you earn. Let's fix your budget first.`
            : "Your income covers your expenses exactly. Find ways to reduce spending to unlock a surplus."}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Investable surplus" className={cn("bg-field rounded-[24px] p-5", className)}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-paper text-forest" aria-hidden="true">
          <TrendingUp className="h-[18px] w-[18px]" />
        </span>
        <h3 className="text-[15px] font-semibold text-forest">Your investable surplus</h3>
      </div>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display tabular-nums text-[32px] leading-none tracking-[-0.04em] text-forest">
          {fmt(surplus, currency)}
        </span>
        <span className="text-[13px] text-forest/70">/ month</span>
      </p>

      <div className="mt-4 rounded-2xl bg-paper/60 p-4">
        <p className="text-[13px] leading-[1.45] text-forest">If invested at 7% annually over 10 years, this becomes</p>
        <p className="mt-1 text-[16px] font-semibold tabular-nums text-forest">{fmt(projectedValue, currency)}</p>
        <p className="mt-1 text-[11px] leading-[1.45] text-forest/70">Compound growth projection · assumes a consistent monthly contribution</p>
      </div>

      <a
        href="/book"
        className="mt-4 flex min-h-11 items-center justify-between gap-3 text-[14px] font-semibold text-forest"
      >
        <span>Start a regular savings plan with an advisor</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-paper" aria-hidden="true">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </a>
    </section>
  );
}
