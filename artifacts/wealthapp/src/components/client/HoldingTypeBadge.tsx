import {
  TrendingUp, Cpu, Home, Landmark, Shield, Package,
  BarChart3, PieChart, Layers, FileText,
} from "lucide-react";
import { getHoldingTypeConfig } from "@/lib/holdingTypeConfig";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Cpu, Home, Landmark, Shield, Package,
  BarChart3, PieChart, Layers, FileText,
};

interface HoldingTypeBadgeProps {
  type: string;
  size?: "sm" | "md";
}

export default function HoldingTypeBadge({ type, size = "md" }: HoldingTypeBadgeProps) {
  const config = getHoldingTypeConfig(type);
  const Icon = ICON_MAP[config.icon] ?? Package;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.color,
        config.textColor,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {config.label}
    </span>
  );
}
