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
  teal:  "background: #E6F5EE; color: #1D9E75;",
  navy:  "background: #EBF0F7; color: #042C53;",
  amber: "background: #FEF3D6; color: #C8881C;",
  red:   "background: #FEEAE8; color: #D86B5A;",
};

export default function StatCard({ label, value, sub, icon: Icon, trend, className, color = "teal" }: StatCardProps) {
  return (
    <div
      className={cn("bg-white rounded-[20px] p-5", className)}
      style={{ boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 10, color: "#A8A095", marginBottom: 2 }}>{label}</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: "#042C53" }} className="truncate">
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: 10, marginTop: 3, color: trend === "up" ? "#1D9E75" : trend === "down" ? "#D86B5A" : "#A8A095", fontWeight: 500 }}>
              {sub}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ ...(Object.fromEntries(iconBgMap[color].split(";").filter(Boolean).map(s => { const [k, v] = s.split(":"); return [k.trim().replace(/-./g, m => m[1].toUpperCase()), v.trim()]; }))) } as React.CSSProperties}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
