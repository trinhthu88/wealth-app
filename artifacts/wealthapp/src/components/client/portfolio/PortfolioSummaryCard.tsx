import CurrencyField from "@/components/shared/CurrencyField";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  totalValue: number;
  segments: Segment[];
}

export default function PortfolioSummaryCard({ totalValue, segments }: Props) {
  // Sort segments largest first
  const sorted = [...segments].sort((a, b) => b.value - a.value);

  // Calculate dash arrays for the donut chart
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const chartSegments = sorted.map(seg => {
    const pct = totalValue > 0 ? seg.value / totalValue : 0;
    const dashArray = pct * circumference;
    const dashOffset = currentOffset;
    currentOffset -= dashArray;

    return {
      ...seg,
      pct,
      dashArray: `${dashArray} ${circumference}`,
      dashOffset,
    };
  });

  return (
    <div className="bg-surface rounded-[28px] p-[22px] shadow-[0_2px_14px_rgba(20,52,42,.06)] mb-4 flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="w-[132px] h-[132px] flex-none -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--hairline)" strokeWidth="18" />
        {chartSegments.map((seg, i) => (
          seg.pct > 0 && (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              className="transition-all duration-1000 ease-out"
            />
          )
        ))}
      </svg>
      <div className="flex flex-col gap-[9px]">
        <div className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em] tabular-nums">
          <CurrencyField amountUsd={totalValue} />
        </div>
        {chartSegments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-[13.5px] text-ink-60">
            <span
              className="w-[10px] h-[10px] rounded-[3px] flex-none"
              style={{ backgroundColor: seg.color }}
            />
            <span className="truncate">{seg.label} {Math.round(seg.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
