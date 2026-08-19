import { useState } from "react";
import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, PieChart, Calculator, Target,
  Wallet, MessageSquare, FolderOpen, Menu, X, ChevronLeft, ChevronRight, Activity
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// 7 destinations (down from 11) — Net Worth, Packages, Transactions, and Financial Plan
// no longer stand on their own; see ClientDashboard, ClientPortfolio, and ClientGoals.
const SIDEBAR_NAV: NavItem[] = [
  { label: "Dashboard",           href: "/client/dashboard",    icon: LayoutDashboard },
  { label: "Investment accounts", href: "/client/portfolio",    icon: PieChart },
  { label: "Scenarios",           href: "/client/scenarios",    icon: Calculator },
  { label: "Health score",        href: "/client/health-score", icon: Activity },
  { label: "Goals",               href: "/client/goals",        icon: Target },
  { label: "Budget",              href: "/client/budget",       icon: Wallet },
  { label: "Messages",            href: "/client/messages",     icon: MessageSquare },
  { label: "Documents",           href: "/client/documents",    icon: FolderOpen },
];

const BOTTOM_NAV_PRIMARY: NavItem[] = [
  { label: "Home",      href: "/client/dashboard",    icon: LayoutDashboard },
  { label: "Accounts",  href: "/client/portfolio",    icon: PieChart },
  { label: "Scenarios", href: "/client/scenarios",    icon: Calculator },
  { label: "Health",    href: "/client/health-score", icon: Activity },
];

const BOTTOM_NAV_MORE: NavItem[] = [
  { label: "Goals",     href: "/client/goals",     icon: Target },
  { label: "Budget",    href: "/client/budget",    icon: Wallet },
  { label: "Messages",  href: "/client/messages",  icon: MessageSquare },
  { label: "Documents", href: "/client/documents", icon: FolderOpen },
];

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [active] = useRoute(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        "text-white/60 hover:text-white hover:bg-white/10",
        active && "bg-white/15 text-white",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="text-[13px]">{item.label}</span>}
    </Link>
  );
}

function BottomTab({ item }: { item: NavItem }) {
  const [active] = useRoute(item.href);
  const Icon = item.icon;
  return (
    <Link href={item.href} className="flex-1 border-none bg-transparent flex flex-col items-center justify-center gap-1.5 cursor-pointer outline-none">
      <div className={cn(
        "flex flex-col items-center gap-1.5 transition-colors",
        active ? "text-[#1D9E75]" : "text-[#A8A095]"
      )}>
        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center transition-colors", active ? "bg-[#E6F5EE]" : "bg-[#FAF8F5]")}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-semibold leading-none">{item.label}</span>
      </div>
    </Link>
  );
}

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

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const sidebar = (
    <aside
      className={cn(
        "h-full bg-[#042C53] flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center px-4 py-5 border-b border-white/10",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0"><SolLogo size={32} /></div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-white text-lg tracking-tight leading-none">tala</div>
              <div className="text-[10px] font-mono tracking-widest uppercase mt-0.5 px-1.5 py-0.5 rounded-md inline-block bg-[#1D9E75]/20 text-[#1D9E75]">
                Investment
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {SIDEBAR_NAV.map((item) => (
          <SidebarLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* User */}
      <div className={cn("p-3 border-t border-white/10", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{profile?.fullName ?? "Client"}</div>
              <div className="text-[11px] text-white/40 truncate font-mono">{profile?.email ?? ""}</div>
            </div>
          </div>
        ) : (
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F2EFE9] font-sans">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:shrink-0 relative z-30">
        {sidebar}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-[72px] z-10 h-6 w-6 rounded-full border border-white/20 bg-[#042C53] text-white/60 flex items-center justify-center hover:bg-[#1D9E75] hover:text-white hover:border-[#1D9E75] transition-all shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden h-12 border-b border-[#E6E1D8] bg-[#F2EFE9] flex items-center px-4 gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <SolLogo size={20} />
            <span className="font-bold text-[#042C53] text-sm font-mono tracking-widest uppercase">tala</span>
          </div>
          <div className="flex-1" />
          <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-6">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FFFFFF] border-t border-[#E6E1D8]" style={{ height: 76 }}>
          <div className="flex items-stretch px-2 h-full pb-[env(safe-area-inset-bottom)]">
            {BOTTOM_NAV_PRIMARY.map((item) => (
              <BottomTab key={item.href} item={item} />
            ))}
            {/* More button */}
            <button
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-1 text-[#A8A095] hover:text-[#1D9E75] transition-colors"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <div className="w-6 h-6 rounded-lg bg-[#FAF8F5] flex items-center justify-center transition-colors">
                <Menu className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-semibold leading-none">More</span>
            </button>
          </div>
        </div>

        {/* More drawer */}
        {moreOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex items-end">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMoreOpen(false)}
            />
            <div className="relative z-10 w-full bg-white rounded-t-2xl shadow-2xl p-4 pb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#042C53]">More</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {BOTTOM_NAV_MORE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-xl bg-[#042C53]/5 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-[#042C53]" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 text-center leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
