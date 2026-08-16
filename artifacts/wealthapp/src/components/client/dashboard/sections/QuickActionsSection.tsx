import { Link } from "wouter";
import { Plus, Calculator, MessageSquare, FolderOpen, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface PillProps {
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}

function Pill({ href, icon: Icon, label, primary }: PillProps) {
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap cursor-pointer transition-all active:scale-[0.97]",
        primary
          ? "bg-[#1D9E75] text-white border-[#1D9E75] hover:bg-[#0F6E56]"
          : "bg-white text-[#042C53] border-[#E2E8F0] hover:bg-[#F8FAFB] hover:border-[#1D9E75]"
      )}>
        <Icon className={cn("h-4 w-4 shrink-0", primary ? "text-white" : "text-[#1D9E75]")} />
        {label}
      </div>
    </Link>
  );
}

interface Props {
  isTrackA: boolean;
}

export default function QuickActionsSection({ isTrackA }: Props) {
  const actions = isTrackA
    ? [
        { href: "/client/portfolio", icon: Plus, label: "+ Add investment", primary: true },
        { href: "/client/scenarios", icon: Calculator, label: "Run a scenario" },
        { href: "/client/messages", icon: MessageSquare, label: "Message advisor" },
        { href: "/client/documents", icon: FolderOpen, label: "View documents" },
      ]
    : [
        { href: "/client/portfolio", icon: Plus, label: "+ Add investment", primary: true },
        { href: "/client/scenarios", icon: Calculator, label: "Run a scenario" },
        { href: "/client/messages", icon: Phone, label: "Book a call" },
        { href: "/client/documents", icon: FolderOpen, label: "View documents" },
      ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {actions.map(a => (
        <Pill key={a.href + a.label} href={a.href} icon={a.icon} label={a.label} primary={a.primary} />
      ))}
    </div>
  );
}
