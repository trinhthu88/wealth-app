import { ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  kind: "advised" | "self";
  className?: string;
}

export default function SourceBadge({ kind, className }: Props) {
  const isAdvised = kind === "advised";
  const Icon = isAdvised ? ShieldCheck : User;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        isAdvised ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "bg-slate-100 text-slate-600",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {isAdvised ? "Advised" : "Self-tracked"}
    </span>
  );
}
