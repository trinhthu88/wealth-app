import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import Sol from "../Sol";
import { Drawer } from "vaul";
import {
  LayoutDashboard, PieChart, Calculator, Target,
  Wallet, MessageSquare, FolderOpen, ChevronLeft, ChevronRight, Activity, Map, MoreHorizontal
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const SIDEBAR_NAV: NavItem[] = [
  { label: "Home",           href: "/client/dashboard",    icon: LayoutDashboard },
  { label: "Portfolio",      href: "/client/portfolio",    icon: PieChart },
  { label: "Pathway",        href: "/client/plan",         icon: Map },
  { label: "Scenarios",      href: "/client/scenarios",    icon: Calculator },
  { label: "Health score",   href: "/client/health-score", icon: Activity },
  { label: "Goals",          href: "/client/goals",        icon: Target },
  { label: "Budget",         href: "/client/budget",       icon: Wallet },
  { label: "Messages",       href: "/client/messages",     icon: MessageSquare },
  { label: "Documents",      href: "/client/documents",    icon: FolderOpen },
];

const MOBILE_MORE_NAV = SIDEBAR_NAV.filter(
  (item) => !["/client/dashboard", "/client/plan", "/client/goals"].includes(item.href),
);

function TabIcon({ active, label }: { active: boolean; label: string }) {
  if (label === "Home") return <div className={cn("w-[22px] h-[22px] rounded-[7px]", active ? "bg-green" : "border-2 border-ink-20")} />;
  if (label === "Plan") return <div className={cn("w-[22px] h-[22px] rounded-[7px]", active ? "bg-green" : "border-2 border-ink-20")} />;
  if (label === "Goals") return <div className={cn("w-[22px] h-[22px] rounded-full", active ? "bg-green" : "border-2 border-ink-20")} />;
  return <div className={cn("w-[22px] h-[22px] rounded-[3px]", active ? "bg-green" : "border-2 border-ink-20")} />;
}

function BottomTab({ href, label }: { href: string; label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href} className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer outline-none" aria-current={active ? "page" : undefined}>
      <TabIcon active={active} label={label} />
      <span className={cn("text-[11.5px] font-semibold leading-none", active ? "text-green" : "text-ink-20")}>{label}</span>
    </Link>
  );
}

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [location] = useLocation();
  const [solOpen, setSolOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isPathway] = useRoute("/client/plan");
  const isMoreRoute = MOBILE_MORE_NAV.some((item) => item.href === location);
  
  const sidebar = (
    <aside className={cn("h-full bg-surface border-r border-hairline flex flex-col transition-all duration-200", collapsed ? "w-20" : "w-64")}>
      <div className={cn("flex items-center px-6 py-6 border-b border-hairline", collapsed && "justify-center px-2")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0"><Sol size="sm" animate="idle" showRays={false} /></div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-semibold text-forest text-xl tracking-tight leading-none">tala</div>
              <div className="text-[10px] font-sans font-bold tracking-[0.06em] uppercase mt-1 px-2 py-0.5 rounded-md inline-block bg-green-tint text-green">
                Advised
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {SIDEBAR_NAV.map((item) => {
          const [active] = useRoute(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
        })}
      </nav>

      <div className={cn("p-4 border-t border-hairline", collapsed && "flex justify-center px-2")}>
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-forest truncate">{profile?.fullName ?? "Client"}</div>
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
    <div className={cn("flex h-screen overflow-hidden font-sans transition-colors duration-300", isPathway ? "bg-forest" : "bg-paper")}>
      <div className="hidden lg:flex lg:flex-col lg:shrink-0 relative z-30">
        {sidebar}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-[72px] z-10 h-6 w-6 rounded-full border border-hairline bg-surface text-ink-40 flex items-center justify-center hover:text-forest hover:border-forest transition-all shadow-sm"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Safe area status bar placeholder for exact visual match if needed */}
        <div className="hidden md:flex h-14 items-center justify-between px-7 text-sm font-semibold flex-none" style={{ color: isPathway ? "var(--paper)" : "var(--forest)" }}>
          {/* Optional top bar details */}
        </div>

        <main className="flex-1 overflow-y-auto px-[22px] md:px-[26px] pb-28 lg:pb-[26px] pt-4 md:pt-0 mx-auto w-full max-w-[440px] md:max-w-none md:pr-10 lg:pl-10">
          {children}
        </main>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-hairline-2 h-[88px]">
          <div className="flex items-start justify-around pt-3 h-full pb-[env(safe-area-inset-bottom)]">
            <BottomTab href="/client/dashboard" label="Home" />
            <BottomTab href="/client/plan" label="Plan" />
            
            <button 
              onClick={() => setSolOpen(true)}
              className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer -mt-1.5 outline-none"
              aria-label="Talk to Sol"
            >
              <div className="w-[34px] h-[34px] rounded-full bg-sun flex items-center justify-center shadow-[0_2px_8px_rgba(255,182,39,0.4)]">
                <div className={cn("w-[12px] h-[12px] rounded-full", isPathway ? "bg-forest" : "bg-paper")} />
              </div>
              <span className="text-[11.5px] font-semibold text-sun-deep">Sol</span>
            </button>

            <BottomTab href="/client/goals" label="Goals" />

            <button
              onClick={() => setMenuOpen(true)}
              className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer outline-none"
              aria-label="Open more navigation"
              aria-expanded={menuOpen}
            >
              <div
                className={cn(
                  "w-[22px] h-[22px] rounded-[7px] flex items-center justify-center",
                  isMoreRoute ? "bg-green text-paper" : "border-2 border-ink-20 text-ink-20",
                )}
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <span
                className={cn(
                  "text-[11.5px] font-semibold leading-none",
                  isMoreRoute ? "text-green" : "text-ink-20",
                )}
              >
                More
              </span>
            </button>
          </div>
        </div>

        <Drawer.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-forest/40 z-50 backdrop-blur-sm" />
            <Drawer.Content className="bg-paper rounded-t-[32px] max-h-[82vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none max-w-[440px] mx-auto">
              <Drawer.Title className="sr-only">More navigation</Drawer.Title>
              <Drawer.Description className="sr-only">
                Open your portfolio, planning tools, messages, documents, or profile.
              </Drawer.Description>
              <div className="overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom))]">
                <div className="mx-auto my-4 h-1.5 w-12 rounded-full bg-hairline" />
                <div className="flex items-center gap-3 rounded-[22px] border border-hairline bg-surface p-4">
                  <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-forest">{profile?.fullName ?? "Client"}</div>
                    <div className="truncate text-[13px] text-ink-40">{profile?.email ?? ""}</div>
                  </div>
                </div>
                <nav aria-label="More client destinations" className="mt-4 grid grid-cols-2 gap-2">
                  {MOBILE_MORE_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === location;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-[18px] border px-3.5 py-3 text-[14px] font-semibold",
                          active
                            ? "border-green/20 bg-green-tint text-green"
                            : "border-hairline bg-surface text-ink-60 hover:text-forest",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>

        <Drawer.Root open={solOpen} onOpenChange={setSolOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-forest/40 z-50 backdrop-blur-sm" />
            <Drawer.Content className="bg-paper flex flex-col rounded-t-[32px] h-[80vh] mt-24 fixed bottom-0 left-0 right-0 z-50 focus:outline-none max-w-[440px] mx-auto">
              <Drawer.Title className="sr-only">Talk to Sol</Drawer.Title>
              <Drawer.Description className="sr-only">
                Ask TALA's financial coach about scenarios, goals, or your budget.
              </Drawer.Description>
              <div className="p-4 bg-paper rounded-t-[32px] flex-1 overflow-y-auto">
                <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-hairline mb-8" />
                
                <div className="flex items-start gap-3">
                  <Sol size="sm" animate="breathe" />
                  <div className="bg-surface rounded-2xl rounded-tl-none p-4 shadow-sm max-w-[80%] border border-hairline">
                    <p className="text-sm text-forest leading-relaxed text-pretty">
                      Morning! I'm Sol. I can model scenarios, check your goals, or review your budget with you.
                    </p>
                  </div>
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </div>
  );
}