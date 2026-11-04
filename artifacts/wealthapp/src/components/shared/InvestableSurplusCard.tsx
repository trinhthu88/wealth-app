import { cn } from "@/lib/utils";
import TalkToAdvisorButton from "@/components/TalkToAdvisorButton";

interface Props {
  surplus: number;
  currency?: string;
  className?: string;
}

function fmt(n: number, currency: string) {
  const sym = currency === "VND" ? "₫" : "$";
  return `${sym}${Math.round(Math.abs(n)).toLocaleString()}`;
}

/**
 * Budget surplus prompt (approved free design): a Spring Field strip with the
 * month's left-over amount and one action — put it toward a goal. Over-income
 * months switch to Sunset Pop ("needs attention"); break-even months are quiet.
 */
export default function InvestableSurplusCard({ surplus, currency = "USD", className }: Props) {
  const r = 0.07 / 12;
  const n = 120;
  const projectedValue = surplus > 0 ? surplus * ((Math.pow(1 + r, n) - 1) / r) : 0;

  if (surplus <= 0) {
    const over = surplus < 0;
    return (
      <section
        aria-label="Investable surplus"
        className={cn("rounded-[24px] p-4 text-forest", over ? "bg-sun" : "bg-surface", className)}
      >
        <p className="text-[14px] font-semibold leading-[1.45] text-pretty">
          {over ? `You're spending ${fmt(surplus, currency)} more than you earn.` : "Your income covers your spending exactly."}
        </p>
        <p className={cn("mt-1 text-[13px] leading-[1.5] text-pretty", over ? "text-forest" : "text-ink-40")}>
          {over
            ? "Let's bring the budget back in line first — the Spending list below shows where it goes."
            : "Trimming one category is the quickest way to unlock a surplus you can put toward a goal."}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Investable surplus" className={cn("flex items-center gap-3 rounded-[24px] bg-field p-4", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-[1.45] text-forest text-pretty">
          You have <span className="font-semibold tabular-nums">{fmt(surplus, currency)}</span> left over. Put some toward a goal?
        </p>
        <p className="mt-1 text-[12px] leading-[1.45] text-forest/80 text-pretty">
          Invested monthly at 7% for 10 years, that could grow to <span className="font-semibold tabular-nums">{fmt(projectedValue, currency)}</span>.
        </p>
      </div>
      <TalkToAdvisorButton
        source="C4_surplus"
        location="investable_surplus_card"
        className="inline-flex h-11 shrink-0 items-center rounded-full bg-forest px-4 text-[13px] font-semibold text-paper whitespace-nowrap transition-opacity hover:opacity-90"
      >
        Talk to an advisor
      </TalkToAdvisorButton>
    </section>
  );
}
