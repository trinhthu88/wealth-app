import { Link, useRoute } from "wouter";
import { LayoutDashboard, Wallet, Target, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Home", href: "/free/dashboard", icon: LayoutDashboard },
  { label: "Budget", href: "/free/budget", icon: Wallet },
  { label: "Goals", href: "/free/goals", icon: Target },
  { label: "Score", href: "/free/health-score", icon: Activity },
];

function Tab({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href} className={cn(
      "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )}>
      <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
      {label}
    </Link>
  );
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-stretch md:hidden z-40">
      {TABS.map(tab => <Tab key={tab.href} {...tab} />)}
    </nav>
  );
}
