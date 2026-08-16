function gaugeColor(rate: number): string {
  if (rate >= 20) return "#1D9E75";
  if (rate >= 10) return "#F59E0B";
  return "#EF4444";
}

function gaugeLabel(rate: number): string {
  if (rate < 0) return "Budget in deficit. Expenses exceed income.";
  if (rate === 0) return "No surplus this month.";
  if (rate < 5) return "Very low savings rate. Review your expenses.";
  if (rate < 10) return "Low savings rate. Consider reducing expenses.";
  if (rate < 20) return "Decent savings rate. Room to grow.";
  if (rate < 30) return "Great savings rate. You're on the right track.";
  return "Excellent savings rate. You're building wealth fast.";
}

interface Props {
  savingsRatePct: number;
}

export default function SavingsRateGauge({ savingsRatePct }: Props) {
  const rate = Math.max(0, Math.min(100, savingsRatePct));
  const color = gaugeColor(savingsRatePct);

  // SVG semi-circle: viewBox 0 0 120 70
  // Arc center: (60, 60), radius 50
  // Sweep from 180° to 0° (left to right)
  const cx = 60, cy = 60, r = 50;
  const angle = (rate / 100) * Math.PI; // 0 to π
  const startX = cx - r; // left end of arc
  const endX = cx - r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  const largeArc = rate > 50 ? 1 : 0;

  // Target line at 20%
  const targetAngle = (20 / 100) * Math.PI;
  const tx = cx - r * Math.cos(targetAngle);
  const ty = cy - r * Math.sin(targetAngle);
  // Tick marks at target (extend radially)
  const tInnerX = cx - (r - 6) * Math.cos(targetAngle);
  const tInnerY = cy - (r - 6) * Math.sin(targetAngle);
  const tOuterX = cx - (r + 6) * Math.cos(targetAngle);
  const tOuterY = cy - (r + 6) * Math.sin(targetAngle);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 120 70" className="w-full max-w-[160px]" aria-hidden="true">
        {/* Track arc (gray) */}
        <path
          d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {rate > 0 && (
          <path
            d={`M ${startX} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
          />
        )}
        {/* Target tick at 20% */}
        <line x1={tInnerX} y1={tInnerY} x2={tOuterX} y2={tOuterY} stroke="#94A3B8" strokeWidth="1.5" />
        {/* Target label */}
        <text x={tOuterX + 1} y={tOuterY - 2} fontSize="5" fill="#94A3B8" textAnchor="middle">20%</text>
        {/* Center % value */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="600" fill="#042C53">
          {savingsRatePct < 0 ? "–" : `${Math.round(Math.max(0, savingsRatePct))}%`}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#94A3B8">
          savings rate
        </text>
      </svg>
      <p className="text-xs text-slate-500 text-center">{gaugeLabel(savingsRatePct)}</p>
    </div>
  );
}
