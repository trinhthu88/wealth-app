import { useState } from "react";
import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, TrendingUp, Target, DollarSign, BarChart3, Heart,
  Users, ClipboardList, Star, MessageSquare, FileText, Settings,
  ChevronLeft, ChevronRight, Map, BookOpen, Menu, X, Bell,
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
  { label: "My Plan", href: "/client/plan", icon: ClipboardList },
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
  { label: "Blog", href: "/admin/blog", icon: BookOpen },
  { label: "Clients", href: "/advisor/clients", icon: ClipboardList },
  { label: "Leads", href: "/advisor/leads", icon: Star },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [active] = useRoute(item.href);
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <a className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        active && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
        collapsed && "justify-center px-2"
      )}>
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </a>
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

  const Sidebar = (
    <aside className={cn(
      "h-full bg-sidebar flex flex-col transition-all duration-200",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className={cn("flex items-center px-4 py-5 border-b border-sidebar-border", collapsed && "justify-center px-2")}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sidebar-foreground text-sm">WealthApp</div>
              <div className="text-xs text-sidebar-foreground/50">{roleLabel} Portal</div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map(item => <NavLink key={item.href} item={item} collapsed={collapsed} />)}
      </nav>

      <div className={cn("p-3 border-t border-sidebar-border", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-sidebar-foreground truncate">{profile?.fullName ?? "User"}</div>
              <div className="text-xs text-sidebar-foreground/50 truncate">{profile?.email ?? ""}</div>
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
          className="absolute -right-3 top-16 z-10 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-foreground flex items-center justify-center hover:bg-sidebar-primary hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-60 h-full flex flex-col">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
          <button className="md:hidden" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <div className="md:hidden">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
