import { useState } from "react";
import { Link, useLocation } from "wouter";
import { UserButton } from "@clerk/react";
import { Drawer } from "vaul";
import {
  House, ChartLine, Target, Menu, ChevronLeft, ChevronRight, ArrowUpRight,
  Wallet, HeartPulse, Map, Trophy, Settings, Briefcase, LayoutDashboard, TrendingUp,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { openSolChat } from "@/lib/solChat";
import { FREE_PRIMARY_NAV, getFreeNavigationState, type FreePrimaryNavId } from "@/lib/freeNavigation";
import Sol from "@/components/Sol";
import BottomSheet from "@/components/client/BottomSheet";
import PlanPicker from "@/components/PlanPicker";

const NAV_ICONS: Record<FreePrimaryNavId, React.ElementType> = {
  home: House,
  wealth: ChartLine,
  goals: Target,
  more: Menu,
};

// Desktop sidebar: the same places, grouped the way the menu bar groups them.
const SIDEBAR_GROUPS: { label: string; items: { label: string; href: string; icon: React.ElementType }[] }[] = [
  {
    label: "Home",
    items: [
      { label: "Overview", href: "/free/dashboard", icon: LayoutDashboard },
      { label: "Budget", href: "/free/budget", icon: Wallet },
      { label: "Health score", href: "/free/health-score", icon: HeartPulse },
    ],
  },
  {
    label: "Wealth",
    items: [
      { label: "Net worth", href: "/free/networth", icon: TrendingUp },
      { label: "Portfolio", href: "/free/portfolio", icon: Briefcase },
    ],
  },
  {
    label: "Goals",
    items: [
      { label: "Goals", href: "/free/goals", icon: Target },
      { label: "Pathway", href: "/free/pathway", icon: Map },
      { label: "Milestones", href: "/free/milestones", icon: Trophy },
    ],
  },
];

const MORE_ITEMS = [
  { label: "Budget", href: "/free/budget", icon: Wallet },
  { label: "Health score", href: "/free/health-score", icon: HeartPulse },
  { label: "Pathway", href: "/free/pathway", icon: Map },
  { label: "Milestones", href: "/free/milestones", icon: Trophy },
  { label: "Portfolio", href: "/free/portfolio", icon: Briefcase },
  { label: "Settings", href: "/free/settings", icon: Settings },
];

/** The one Cobalt upsell card: an advisor relationship is what the paid plan adds. */
function AdvisedPlanCard({ location, onOpen }: { location: string; onOpen: () => void }) {
  return (
    <div className="rounded-[24px] bg-forest p-5 text-paper">
      <div className="tala-eyebrow text-mint">Advised plan</div>
      <p className="mt-3 text-[15px] font-medium leading-[1.45] text-paper text-pretty">
        A tala advisor, a managed portfolio and what-if planning on your goals.
      </p>
      <button
        type="button"
        onClick={() => { track("upgrade_cta_clicked", { location }); onOpen(); }}
        className="mt-4 inline-flex h-11 w-full items-center justify-between rounded-full bg-field pl-5 pr-1.5 text-[14px] font-semibold text-forest transition-opacity hover:opacity-90"
      >
        See plans
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-paper">
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}

function MobileNavLink({ id, label, href, active }: { id: FreePrimaryNavId; label: string; href: string; active: boolean }) {
  const Icon = NAV_ICONS[id];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={!active ? label : undefined}
      className={cn(
        "flex h-12 min-w-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors",
        active ? "bg-field px-4 pl-3 text-forest" : "text-paper hover:bg-white/10",
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
      {active && <span className="whitespace-nowrap leading-none">{label}</span>}
    </Link>
  );
}

export default function FreeAppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  const navigation = getFreeNavigationState(pathname);
  const isPathway = pathname === "/free/pathway";

  const sidebar = (
    <aside className={cn("h-full bg-surface border-r border-hairline flex flex-col transition-all duration-200", collapsed ? "w-20" : "w-64")}>
      <div className={cn("flex items-center px-6 py-6 border-b border-hairline", collapsed && "justify-center px-2")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0"><Sol size="sm" animate="idle" showRays={false} /></div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-forest text-xl tracking-tight leading-none">tala</div>
              <div className="text-[10px] font-sans font-bold tracking-[0.06em] uppercase mt-1 px-2 py-0.5 rounded-md inline-block bg-field text-forest">
                Free plan
              </div>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-5" aria-label="Free plan navigation">
        {SIDEBAR_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && <div className="tala-eyebrow text-ink-30 px-3 mb-1.5">{group.label}</div>}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-[14px] font-semibold transition-colors",
                      active ? "bg-green-tint text-green" : "text-ink-40 hover:bg-hairline/40 hover:text-forest",
                      collapsed && "justify-center px-2",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-4 pb-4">
          <AdvisedPlanCard location="free_shell_sidebar" onOpen={() => setPlansOpen(true)} />
        </div>
      )}

      <div className={cn("p-4 border-t border-hairline", collapsed && "flex justify-center px-2")}>
        <div className="flex items-center gap-3 px-2 py-1">
          <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
          {!collapsed && (
            <Link href="/free/settings" className="min-w-0 flex-1 group">
              <div className="text-[14px] font-semibold text-forest truncate group-hover:underline underline-offset-4">{profile?.fullName ?? "You"}</div>
              <div className="text-[12px] text-ink-40 truncate">Settings</div>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className={cn("flex h-dvh overflow-hidden font-sans transition-colors duration-300", isPathway ? "bg-forest" : "bg-paper")}>
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
        <main className="flex-1 overflow-y-auto px-[22px] md:px-[26px] pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-[26px] pt-3 md:pt-6 mx-auto w-full max-w-[440px] md:max-w-[760px] lg:max-w-[880px]">
          <div className="flex items-center justify-between pb-3 lg:hidden">
            <div className="flex items-center gap-2">
              <Sol size="xs" animate="idle" showRays={false} />
              <span className={cn("font-display text-[20px] leading-none", isPathway ? "text-paper" : "text-forest")}>tala</span>
              <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]", isPathway ? "bg-forest-700 text-mint" : "bg-field text-forest")}>Free</span>
            </div>
            <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
          </div>

          {navigation.tabs && (
            <nav aria-label={`${navigation.sectionLabel} sections`} className="mb-5 overflow-x-auto no-scrollbar">
              <div className={cn("flex w-max min-w-full gap-1 rounded-full border p-1", isPathway ? "border-forest-700 bg-forest-700/60" : "border-hairline bg-surface")}>
                {navigation.tabs.map(tab => {
                  const active = navigation.activeTabId === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full px-4 text-[12px] font-semibold transition-colors sm:px-5 sm:text-[13px]",
                        isPathway
                          ? active ? "bg-field text-forest" : "text-mint hover:text-paper"
                          : active ? "bg-forest text-paper" : "text-ink-40 hover:text-forest",
                      )}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}

          {children}
        </main>

        <nav
          aria-label="Main navigation"
          data-testid="mobile-free-navigation"
          className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-30 mx-auto flex h-[68px] max-w-[420px] items-center justify-between rounded-full bg-forest px-2.5 shadow-[0_10px_30px_rgba(12,33,164,0.25)] lg:hidden"
        >
          {FREE_PRIMARY_NAV.slice(0, 2).map(item => (
            <MobileNavLink key={item.id} {...item} active={navigation.primaryId === item.id} />
          ))}
          <button
            type="button"
            onClick={openSolChat}
            aria-label="Ask Sol"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface transition-transform hover:scale-105"
          >
            <Sol size="sm" animate="none" />
          </button>
          <MobileNavLink id="goals" label="Goals" href="/free/goals" active={navigation.primaryId === "goals"} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            aria-expanded={moreOpen}
            className={cn(
              "flex h-12 min-w-12 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors",
              navigation.primaryId === "more" ? "bg-field px-4 pl-3 text-forest" : "text-paper hover:bg-white/10",
            )}
          >
            <Menu className="h-[22px] w-[22px]" aria-hidden="true" />
            {navigation.primaryId === "more" && <span className="whitespace-nowrap leading-none">More</span>}
          </button>
        </nav>
      </div>

      <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-forest/40 z-50 backdrop-blur-sm" />
          <Drawer.Content className="bg-paper rounded-t-[32px] max-h-[86vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none max-w-[440px] mx-auto">
            <Drawer.Title className="sr-only">More</Drawer.Title>
            <Drawer.Description className="sr-only">Budget, health score, pathway, milestones, portfolio and settings.</Drawer.Description>
            <div className="overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom))]">
              <div className="mx-auto my-4 h-1.5 w-12 rounded-full bg-hairline-2" />
              <div className="flex items-center gap-3 px-1 pb-4">
                <UserButton appearance={{ elements: { avatarBox: "h-11 w-11" } }} />
                <div className="min-w-0">
                  <p className="font-display text-[20px] leading-tight text-forest truncate">{profile?.fullName ?? "Your tala"}</p>
                  <p className="text-[13px] text-ink-40">Free plan</p>
                </div>
              </div>
              <nav aria-label="More destinations" className="grid grid-cols-2 gap-2">
                {MORE_ITEMS.map(item => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-[18px] px-3.5 py-3 text-[14px] font-semibold transition-colors",
                        active ? "bg-forest text-paper" : "bg-surface text-forest hover:bg-green-tint",
                      )}
                    >
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", active ? "bg-field text-forest" : "bg-paper text-forest")}>
                        <Icon className="h-[16px] w-[16px]" aria-hidden="true" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-4">
                <AdvisedPlanCard location="free_more_drawer" onOpen={() => { setMoreOpen(false); setPlansOpen(true); }} />
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <BottomSheet isOpen={plansOpen} onClose={() => setPlansOpen(false)} title="Choose your plan">
        <PlanPicker />
      </BottomSheet>
    </div>
  );
}
