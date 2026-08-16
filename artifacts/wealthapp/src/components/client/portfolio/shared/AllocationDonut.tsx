import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  totalLabel: string;
}

export default function AllocationDonut({ segments, totalLabel }: Props) {
  const filtered = segments.filter(s => s.value > 0);
  if (filtered.length === 0) return null;

  const total = filtered.reduce((s, seg) => s + seg.value, 0);
  const ariaLabel = `Portfolio allocation: ${filtered.map(s => `${s.label} ${((s.value / total) * 100).toFixed(0)}%`).join(", ")}`;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
      <p className="text-sm font-semibold text-[#042C53] mb-4">Allocation</p>
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div role="img" aria-label={ariaLabel} className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={filtered} cx="50%" cy="50%" innerRadius={52} outerRadius={76} dataKey="value" strokeWidth={2} stroke="#fff">
                {filtered.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, ""]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-bold text-[#042C53] text-center leading-tight px-2">{totalLabel}</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          {filtered.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm text-[#042C53] flex-1 truncate">{s.label}</span>
              <span className="text-sm font-medium text-slate-600 shrink-0">
                {((s.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
