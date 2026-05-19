import { useState } from "react";
import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, TrendingUp, Target, DollarSign, BarChart3, Heart,
  Users, ClipboardList, Star, MessageSquare, FileText, Settings,
  ChevronLeft, ChevronRight, Map, BookOpen, Menu, X, Bell,
  Package, ArrowLeftRight, LineChart, Layers, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem { label: string; href: string; icon: React.ElementType }

const FREE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/free/dashboard", icon: LayoutDashboard },
  { label: "My Pathway", href: "/free/pathway", icon: Map },
  { label: "Budget", href: "/free/budget", icon: DollarSign },
  { label: "Goals", href: "/free/goals", icon: Target },
  { label: "Net Worth", href: "/free/networth", icon: TrendingUp },
  { label: "Health Score", href: "/free/health-score", icon: Heart },
];

const CLIENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
  { label: "Portfolio", href: "/client/portfolio", icon: BarChart3 },
  { label: "My Packages", href: "/client/packages", icon: Package },
  { label: "Transactions", href: "/client/transactions", icon: ArrowLeftRight },
  { label: "Scenarios", href: "/client/scenarios", icon: LineChart },
  { label: "Goals", href: "/client/goals", icon: Target },
  { label: "Net Worth", href: "/client/networth", icon: TrendingUp },
  { label: "Documents", href: "/client/documents", icon: FileText },
  { label: "Messages", href: "/client/messages", icon: MessageSquare },
];

const ADVISOR_NAV: NavItem[] = [
  { label: "Dashboard", href: "/advisor/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/advisor/clients", icon: Users },
  { label: "Tasks", href: "/advisor/tasks", icon: ClipboardList },
  { label: "Leads", href: "/advisor/leads", icon: Star },
  { label: "Blog", href: "/admin/blog", icon: BookOpen },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Funds", href: "/admin/funds", icon: Building2 },
  { label: "Blog", href: "/admin/blog", icon: BookOpen },
  { label: "Clients", href: "/advisor/clients", icon: ClipboardList },
  { label: "Leads", href: "/advisor/leads", icon: Star },
];

function SolLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="22" fill="#1D9E75" />
      <g stroke="#1D9E75" strokeWidth="6" strokeLinecap="round">
        <line x1="50" y1="6" x2="50" y2="18" />
        <line x1="50" y1="82" x2="50" y2="94" />
        <line x1="6" y1="50" x2="18" y2="50" />
        <line x1="82" y1="50" x2="94" y2="50" />
        <line x1="20" y1="20" x2="28" y2="28" />
        <line x1="72" y1="72" x2="80" y2="80" />
        <line x1="80" y1="20" x2="72" y2="28" />
        <line x1="28" y1="72" x2="20" y2="80" />
      </g>
    </svg>
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [active] = useRoute(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        active && "bg-sidebar-primary/20 text-sidebar-primary hover:bg-sidebar-primary/25 hover:text-sidebar-primary border border-sidebar-primary/20",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="text-[13px]">{item.label}</span>}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = !profile ? FREE_NAV
    : profile.role === "super_admin" ? ADMIN_NAV
    : profile.role === "advisor" ? ADVISOR_NAV
    : profile.role === "investment_client" ? CLIENT_NAV
    : FREE_NAV;

  const roleLabel = !profile ? "Free"
    : profile.role === "super_admin" ? "Admin"
    : profile.role === "advisor" ? "Advisor"
    : profile.role === "investment_client" ? "Client"
    : "Free";

  const roleBadgeColor = roleLabel === "Admin" ? "bg-amber-500/20 text-amber-400"
    : roleLabel === "Advisor" ? "bg-blue-500/20 text-blue-400"
    : roleLabel === "Client" ? "bg-primary/20 text-primary"
    : "bg-white/10 text-white/50";

  const Sidebar = (
    <aside className={cn(
      "h-full bg-sidebar flex flex-col transition-all duration-200",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className={cn(
        "flex items-center px-4 py-5 border-b border-sidebar-border",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0">
            <SolLogo size={32} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-bold text-white text-lg tracking-tight leading-none">tala</div>
              <div className={cn("text-[10px] font-mono tracking-widest uppercase mt-0.5 px-1.5 py-0.5 rounded-md inline-block", roleBadgeColor)}>
                {roleLabel}
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map(item => <NavLink key={item.href} item={item} collapsed={collapsed} />)}
      </nav>

      <div className={cn("p-3 border-t border-sidebar-border", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-sidebar-foreground truncate">{profile?.fullName ?? "User"}</div>
              <div className="text-[11px] text-sidebar-foreground/40 truncate font-mono">{profile?.email ?? ""}</div>
            </div>
          </div>
        ) : (
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex md:flex-col md:shrink-0 relative">
        {Sidebar}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-[72px] z-10 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/60 flex items-center justify-center hover:bg-sidebar-primary hover:text-white hover:border-sidebar-primary transition-all shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-60 h-full flex flex-col">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center px-4 gap-3 shrink-0">
          <button className="md:hidden text-foreground/70 hover:text-foreground transition-colors" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Bell className="h-4.5 w-4.5" />
          </Button>
          <div className="md:hidden">
            <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
