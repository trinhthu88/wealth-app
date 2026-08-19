import { useState } from "react";
import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, TrendingUp, Target, DollarSign, BarChart3, Heart,
  Users, ClipboardList, Star, MessageSquare, FileText,
  ChevronLeft, ChevronRight, Map, BookOpen, Menu, X,
  ArrowLeftRight, LineChart, Layers, Building2, Sparkles,
} from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ElementType }

const FREE_NAV: NavItem[] = [
  { label: "Dashboard",    href: "/free/dashboard",    icon: LayoutDashboard },
  { label: "My Pathway",   href: "/free/pathway",      icon: Map },
  { label: "Budget",       href: "/free/budget",       icon: DollarSign },
  { label: "Goals",        href: "/free/goals",        icon: Target },
  { label: "Net Worth",    href: "/free/networth",     icon: TrendingUp },
  { label: "Health Score", href: "/free/health-score", icon: Heart },
];

const CLIENT_NAV: NavItem[] = [
  { label: "Dashboard",    href: "/client/dashboard",    icon: LayoutDashboard },
  { label: "Investments",  href: "/client/portfolio",    icon: BarChart3 },
  { label: "Transactions", href: "/client/transactions", icon: ArrowLeftRight },
  { label: "Goals",        href: "/client/goals",        icon: Target },
  { label: "Scenarios",    href: "/client/scenarios",    icon: LineChart },
  { label: "Net Worth",    href: "/client/networth",     icon: TrendingUp },
  { label: "Documents",    href: "/client/documents",    icon: FileText },
  { label: "Messages",     href: "/client/messages",     icon: MessageSquare },
];

const CLIENT_FOOTER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/client/dashboard",    icon: LayoutDashboard },
  { label: "Invest",    href: "/client/portfolio",    icon: BarChart3 },
  { label: "Txns",      href: "/client/transactions", icon: ArrowLeftRight },
  { label: "Goals",     href: "/client/goals",        icon: Target },
  { label: "More",      href: "/client/scenarios",    icon: Layers },
];

const ADVISOR_NAV: NavItem[] = [
  { label: "Dashboard", href: "/advisor/dashboard", icon: LayoutDashboard },
  { label: "Clients",   href: "/advisor/clients",   icon: Users },
  { label: "Tasks",     href: "/advisor/tasks",     icon: ClipboardList },
  { label: "Leads",     href: "/advisor/leads",     icon: Star },
  { label: "Blog",      href: "/admin/blog",        icon: BookOpen },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard",  icon: LayoutDashboard },
  { label: "Users",     href: "/admin/users",      icon: Users },
  { label: "Funds",     href: "/admin/funds",       icon: Building2 },
  { label: "Blog",      href: "/admin/blog",        icon: BookOpen },
  { label: "Clients",   href: "/advisor/clients",   icon: ClipboardList },
  { label: "Leads",     href: "/advisor/leads",     icon: Star },
];

function SolLogo({ size = 28, light = false }: { size?: number; light?: boolean }) {
  const color = light ? "#1D9E75" : "#1D9E75";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="22" fill={color} />
      <g stroke={color} strokeWidth="6" strokeLinecap="round">
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

function NavLink({ item, collapsed, light }: { item: NavItem; collapsed: boolean; light: boolean }) {
  const [active] = useRoute(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        light
          ? cn(
              "text-slate-600 hover:text-[#042C53] hover:bg-slate-100",
              active && "bg-[#1D9E75]/10 text-[#1D9E75] hover:bg-[#1D9E75]/15 hover:text-[#1D9E75]"
            )
          : cn(
              "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              active && "bg-sidebar-primary/20 text-sidebar-primary hover:bg-sidebar-primary/25 hover:text-sidebar-primary border border-sidebar-primary/20"
            ),
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span className="text-[13px]">{item.label}</span>}
    </Link>
  );
}

function ClientFooterTab({ item }: { item: NavItem }) {
  const [active] = useRoute(item.href);
  const Icon = item.icon;
  return (
    <Link href={item.href} className="flex-1" aria-current={active ? "page" : undefined}>
      <div className={cn(
        "flex flex-col items-center gap-1 py-2 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}>
        <div className={cn("p-1.5 rounded-xl transition-colors", active && "bg-primary/10")}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="text-[10px] font-medium leading-none">{item.label}</span>
      </div>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useFocusTrap<HTMLDivElement>(mobileOpen, () => setMobileOpen(false));

  const isClient = profile?.role === "investment_client";
  const isFree = !profile || profile.role === "free_user";

  const nav = !profile ? FREE_NAV
    : profile.role === "super_admin" ? ADMIN_NAV
    : profile.role === "advisor" ? ADVISOR_NAV
    : isClient ? CLIENT_NAV
    : FREE_NAV;

  const Sidebar = (
    <aside className={cn(
      "h-full flex flex-col transition-all duration-200",
      isFree
        ? "bg-white border-r border-slate-200"
        : "bg-sidebar",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo row */}
      <div className={cn(
        "flex items-center px-4 py-5",
        isFree ? "border-b border-slate-100" : "border-b border-sidebar-border",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0">
            <SolLogo size={32} light={isFree} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className={cn(
                "font-display font-bold text-lg tracking-tight leading-none",
                isFree ? "text-[#042C53]" : "text-white"
              )}>
                tala
              </div>
              <div className={cn(
                "text-[10px] font-mono tracking-widest uppercase mt-0.5 px-1.5 py-0.5 rounded-md inline-block",
                isFree
                  ? "bg-slate-100 text-slate-500"
                  : profile?.role === "super_admin" ? "bg-amber-500/20 text-amber-400"
                  : profile?.role === "advisor" ? "bg-blue-500/20 text-blue-400"
                  : "bg-primary/20 text-primary"
              )}>
                {isFree ? "Free plan"
                  : profile?.role === "super_admin" ? "Admin"
                  : profile?.role === "advisor" ? "Advisor"
                  : "Investment"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" aria-label="Primary">
        {nav.map(item => (
          <NavLink key={item.href} item={item} collapsed={collapsed} light={isFree} />
        ))}
      </nav>

      {/* Free plan: upgrade CTA */}
      {isFree && !collapsed && (
        <div className="px-3 pb-3">
          <div className="bg-[#042C53] rounded-xl p-3 text-white space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#1D9E75] shrink-0" />
              <p className="text-xs font-semibold">Investment account</p>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Get a financial advisor, portfolio tracking, and scenario planning.
            </p>
            <a
              href="mailto:hello@tala.app?subject=Upgrade%20to%20Investment%20Account"
              className="flex items-center justify-center w-full py-1.5 rounded-lg bg-[#1D9E75] text-white text-xs font-semibold hover:bg-[#0F6E56] transition-colors"
            >
              Talk to an advisor →
            </a>
          </div>
        </div>
      )}

      {/* User profile */}
      <div className={cn(
        "p-3",
        isFree ? "border-t border-slate-100" : "border-t border-sidebar-border",
        collapsed && "flex justify-center"
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            <div className="min-w-0 flex-1">
              <div className={cn(
                "text-xs font-semibold truncate",
                isFree ? "text-[#042C53]" : "text-sidebar-foreground"
              )}>
                {profile?.fullName ?? "User"}
              </div>
              <div className={cn(
                "text-[11px] truncate font-mono",
                isFree ? "text-slate-400" : "text-sidebar-foreground/40"
              )}>
                {profile?.email ?? ""}
              </div>
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
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col md:shrink-0 relative">
        {Sidebar}
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "absolute -right-3 top-[72px] z-10 h-6 w-6 rounded-full border flex items-center justify-center transition-all shadow-sm",
            isFree
              ? "border-slate-200 bg-white text-slate-400 hover:bg-[#042C53] hover:text-white hover:border-[#042C53]"
              : "border-sidebar-border bg-sidebar text-sidebar-foreground/60 hover:bg-sidebar-primary hover:text-white hover:border-sidebar-primary"
          )}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : <ChevronLeft className="h-3 w-3" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            className="relative z-10 w-60 h-full flex flex-col outline-none"
          >
            {Sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center px-4 gap-3 shrink-0">
          <button
            className="md:hidden text-foreground/70 hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(v => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
          <div className="flex-1" />
          <div className="md:hidden">
            <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
          </div>
        </header>

        <main className={cn(
          "flex-1 overflow-y-auto p-4 md:p-6",
          isClient && "pb-20 md:pb-6"
        )}>
          {children}
        </main>

        {/* Mobile footer nav — investment clients only */}
        {isClient && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur border-t border-border">
            <div className="flex items-stretch px-2 safe-bottom">
              {CLIENT_FOOTER_NAV.map(item => (
                <ClientFooterTab key={item.href} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
