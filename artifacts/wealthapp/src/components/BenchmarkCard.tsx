import { cn } from "@/lib/utils";

interface BenchmarkRow {
  label: string;
  userValue: number;
  avgValue: number;
  p75Value: number;
  suffix: string;
  positiveWhenHigher: boolean;
}

interface Props {
  userSavingsRate: number;
  userHealthScore: number;
  age?: number | null;
}

function getAgeGroup(age: number | null | undefined): "28-35" | "36-40" {
  if (!age || age <= 35) return "28-35";
  return "36-40";
}

const BENCHMARKS: Record<string, { savings_rate: { avg: number; p75: number }; health_score: { avg: number; p75: number } }> = {
  "28-35": { savings_rate: { avg: 14, p75: 20 }, health_score: { avg: 58, p75: 72 } },
  "36-40": { savings_rate: { avg: 17, p75: 24 }, health_score: { avg: 63, p75: 78 } },
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden flex-1">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function BenchmarkCard({ userSavingsRate, userHealthScore, age }: Props) {
  const group = getAgeGroup(age);
  const bm = BENCHMARKS[group];

  const rows: BenchmarkRow[] = [
    {
      label: "Savings rate",
      userValue: userSavingsRate,
      avgValue: bm.savings_rate.avg,
      p75Value: bm.savings_rate.p75,
      suffix: "%",
      positiveWhenHigher: true,
    },
    {
      label: "Health score",
      userValue: userHealthScore,
      avgValue: bm.health_score.avg,
      p75Value: bm.health_score.p75,
      suffix: "/100",
      positiveWhenHigher: true,
    },
  ];

  const maxValues = [35, 100];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">How you compare</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          Age {group}
        </span>
      </div>

      {rows.map((row, i) => {
        const max = maxValues[i];
        const isAhead = row.userValue >= row.avgValue;
        const isTop = row.userValue >= row.p75Value;
        const msg = isTop
          ? "Top 25% for your age group"
          : isAhead
            ? `${Math.round(row.userValue - row.avgValue)}${row.suffix} ahead of peers`
            : `${Math.round(row.avgValue - row.userValue)}${row.suffix} below peer avg`;

        return (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">{row.label}</span>
              <span
                className={cn(
                  "font-semibold text-[11px] px-2 py-0.5 rounded-full",
                  isTop
                    ? "bg-primary/10 text-primary"
                    : isAhead
                      ? "bg-blue-50 text-blue-700"
                      : "bg-amber-50 text-amber-700",
                )}
              >
                {msg}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-10 text-right font-medium text-foreground">
                  {Math.round(row.userValue)}{row.suffix}
                </span>
                <MiniBar value={row.userValue} max={max} color="bg-primary" />
                <span className="text-[10px]">You</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-10 text-right">
                  {row.avgValue}{row.suffix}
                </span>
                <MiniBar value={row.avgValue} max={max} color="bg-blue-300" />
                <span className="text-[10px]">Peers</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
