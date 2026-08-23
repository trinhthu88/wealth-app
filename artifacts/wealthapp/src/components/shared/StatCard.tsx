import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
  color?: "teal" | "navy" | "amber" | "red";
}

const iconBgMap = {
  teal:  "bg-green-tint text-green",
  navy:  "bg-surface border border-hairline text-forest",
  amber: "bg-sun-tint text-amber-ink",
  red:   "bg-clay-tint text-clay-ink",
};

export default function StatCard({ label, value, sub, icon: Icon, trend, className, color = "teal" }: StatCardProps) {
  return (
    <div
      className={cn("bg-surface rounded-[26px] p-5 shadow-[0_2px_14px_rgba(20,52,42,0.06)]", className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-40 font-medium mb-1.5">{label}</p>
          <p className="font-display text-[26px] font-semibold text-forest tracking-[-0.01em] tabular-nums truncate">
            {value}
          </p>
          {sub && (
            <p className={cn("text-[13px] mt-1.5 font-medium tabular-nums",
              trend === "up" ? "text-green" : trend === "down" ? "text-clay" : "text-ink-40"
            )}>
              {sub}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("h-10 w-10 rounded-[14px] flex items-center justify-center shrink-0", iconBgMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
