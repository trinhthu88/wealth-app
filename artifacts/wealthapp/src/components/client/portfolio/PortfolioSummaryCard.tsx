import CurrencyField from "@/components/shared/CurrencyField";
import { cn } from "@/lib/utils";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  totalValue: number;
  segments: Segment[];
}

// Allocation blocks cycle through the palette, largest share first.
// (Cobalt is reserved for the single hero card above them.)
const BLOCK_STYLES = [
  { card: "bg-field text-forest", sub: "text-forest" },
  { card: "bg-breeze text-forest", sub: "text-forest" },
  { card: "bg-surface text-forest", sub: "text-ink-40" },
];

export default function PortfolioSummaryCard({ totalValue, segments }: Props) {
  // Sort segments largest first
  const sorted = [...segments].sort((a, b) => b.value - a.value);

  const blocks = sorted.map(seg => ({
    ...seg,
    pct: totalValue > 0 ? seg.value / totalValue : 0,
  }));

  return (
    <div className="space-y-4">
      <section
        aria-label="Invested value"
        className="bg-forest text-paper rounded-[28px] p-5 flex flex-col gap-3"
      >
        <span className="tala-eyebrow text-mint">Invested value</span>
        <span className="font-display tabular-nums text-[52px] leading-none tracking-[-0.04em] text-paper">
          <CurrencyField amountUsd={totalValue} />
        </span>
      </section>

      {blocks.length > 0 && (
        <section aria-label="What you own" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {blocks.map((seg, i) => {
              const style = BLOCK_STYLES[i % BLOCK_STYLES.length];
              return (
                <div key={i} className={cn("rounded-[24px] p-4 flex flex-col gap-1.5 min-w-0", style.card)}>
                  <span className="font-display tabular-nums text-[28px] leading-none tracking-[-0.03em]">
                    {Math.round(seg.pct * 100)}%
                  </span>
                  <span className="text-[14px] font-semibold truncate">{seg.label}</span>
                  <span className={cn("text-[13px] tabular-nums", style.sub)}>
                    <CurrencyField amountUsd={seg.value} compact />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
