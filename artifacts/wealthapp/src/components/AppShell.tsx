import { useState } from "react";
import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn } from "@/lib/utils";
import Sol from "./Sol";
import { 
  Menu, X, LayoutDashboard, Map, DollarSign, Target, TrendingUp, Heart,
  Users, ClipboardList, Star, BookOpen, Building2, ChevronLeft, ChevronRight
} from "lucide-react";

interface NavItem { label: string; href: string; icon: React.ElementType }

const FREE_NAV: NavItem[] = [
  { label: "Home",         href: "/free/dashboard",    icon: LayoutDashboard },
  { label: "My Pathway",   href: "/free/pathway",      icon: Map },
  { label: "Budget",       href: "/free/budget",       icon: DollarSign },
  { label: "Goals",        href: "/free/goals",        icon: Target },
  { label: "Net Worth",    href: "/free/networth",     icon: TrendingUp },
  { label: "Health Score", href: "/free/health-score", icon: Heart },
];

const ADVISOR_NAV: NavItem[] = [
  { label: "Dashboard", href: "/advisor/dashboard", icon: LayoutDashboard },
  { label: "Clients",   href: "/advisor/clients",   icon: Users },
  { label: "Tasks",     href: "/advisor/tasks",     icon: ClipboardList },
  { label: "Leads",     href: "/advisor/leads",     icon: Star },
  { label: "Blog",      href: "/admin/blog",        icon: BookOpen },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard",   icon: LayoutDashboard },
  { label: "Users",     href: "/admin/users",       icon: Users },
  { label: "Funds",     href: "/admin/funds",       icon: Building2 },
  { label: "Blog",      href: "/admin/blog",        icon: BookOpen },
  { label: "Clients",   href: "/advisor/clients",   icon: ClipboardList },
  { label: "Leads",     href: "/advisor/leads",     icon: Star },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [active] = useRoute(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px] font-semibold transition-all duration-150",
        active 
          ? "bg-green-tint text-green" 
          : "text-ink-40 hover:text-forest hover:bg-hairline/30",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const drawerRef = useFocusTrap<HTMLDivElement>(mobileOpen, () => setMobileOpen(false));

  const isFree = !profile || profile.role === "free_user";

  const nav = !profile ? FREE_NAV
    : profile.role === "super_admin" ? ADMIN_NAV
    : profile.role === "advisor" ? ADVISOR_NAV
    : FREE_NAV;

  const Sidebar = (
    <aside className={cn("h-full flex flex-col bg-surface border-r border-hairline transition-all duration-200", collapsed ? "w-20" : "w-64")}>
      <div className={cn("flex items-center px-6 py-6 border-b border-hairline", collapsed && "justify-center px-2")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0"><Sol size="sm" animate="idle" showRays={false} /></div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-semibold text-forest text-xl tracking-tight leading-none">tala</div>
              <div className="text-[10px] font-sans font-bold tracking-[0.06em] uppercase mt-1 px-2 py-0.5 rounded-md inline-block bg-sun-tint text-amber-ink">
                {isFree ? "Free plan"
                  : profile?.role === "super_admin" ? "Admin"
                  : profile?.role === "advisor" ? "Advisor"
                  : "Free plan"}
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto" aria-label="Primary">
        {nav.map(item => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {isFree && !collapsed && (
        <div className="px-6 pb-6">
          <div className="bg-forest rounded-2xl p-5 text-paper">
            <h4 className="text-[15px] font-semibold mb-2">Advised plan</h4>
            <p className="text-[14px] text-mint leading-relaxed mb-4 text-pretty">
              Get a financial advisor, portfolio tracking, and scenario planning.
            </p>
            <a
              href="mailto:hello@tala.app?subject=Upgrade"
              className="flex items-center justify-center w-full h-12 rounded-xl bg-green text-white text-[15px] font-semibold hover:bg-forest-700 transition-colors"
            >
              Talk to an advisor
            </a>
          </div>
        </div>
      )}

      <div className={cn("p-4 border-t border-hairline", collapsed && "flex justify-center px-2")}>
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-forest truncate">{profile?.fullName ?? "User"}</div>
              <div className="text-[13px] text-ink-40 truncate">{profile?.email ?? ""}</div>
            </div>
          </div>
        ) : (
          <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-paper font-sans">
      <div className="hidden md:flex md:flex-col md:shrink-0 relative">
        {Sidebar}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-[72px] z-10 h-6 w-6 rounded-full border border-hairline bg-surface text-ink-40 flex items-center justify-center hover:text-forest hover:border-forest transition-all shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            className="absolute inset-0 bg-forest/40 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            className="relative z-10 w-64 h-full flex flex-col outline-none bg-surface"
          >
            {Sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 md:hidden border-b border-hairline bg-surface/80 backdrop-blur flex items-center px-6 gap-3 shrink-0">
          <button
            className="text-forest hover:text-green transition-colors"
            onClick={() => setMobileOpen(v => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
          <div className="flex-1" />
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </header>

        <main className="flex-1 overflow-y-auto px-[22px] md:px-[26px] pb-28 md:pb-[26px] pt-4 md:pt-[26px] max-w-[440px] md:max-w-none mx-auto w-full md:pr-10 lg:pl-10">
          {children}
        </main>
      </div>
    </div>
  );
}