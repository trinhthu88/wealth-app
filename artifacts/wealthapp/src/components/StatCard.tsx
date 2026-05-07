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

const colorMap = {
  teal: "bg-primary/10 text-primary",
  navy: "bg-accent text-accent-foreground",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-destructive/10 text-destructive",
};

export default function StatCard({ label, value, sub, icon: Icon, trend, className, color = "teal" }: StatCardProps) {
  return (
    <div className={cn("bg-card border border-card-border rounded-xl p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 text-foreground truncate">{value}</p>
          {sub && (
            <p className={cn("text-xs mt-1 font-medium", trend === "up" && "text-green-600 dark:text-green-400", trend === "down" && "text-red-500", trend === "neutral" && "text-muted-foreground", !trend && "text-muted-foreground")}>
              {sub}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
