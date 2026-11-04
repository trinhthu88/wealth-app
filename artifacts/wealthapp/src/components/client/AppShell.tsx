import { useState } from "react";
import { Link, useLocation } from "wouter";
import { UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import Sol from "../Sol";
import {
  House, Wallet, ChartLine, Target, UserRound, ChevronLeft, ChevronRight,
} from "lucide-react";
import { CLIENT_PRIMARY_NAV, getClientNavigationState, type ClientPrimaryNavId } from "@/lib/clientNavigation";
import { openSolChat } from "@/lib/solChat";

const NAV_ICONS: Record<ClientPrimaryNavId, React.ElementType> = {
  home: House,
  budget: Wallet,
  wealth: ChartLine,
  goals: Target,
  advisor: UserRound,
};

function ClientNavigationLink({
  item,
  active,
  mobile = false,
}: {
  item: (typeof CLIENT_PRIMARY_NAV)[number];
  active: boolean;
  mobile?: boolean;
}) {
  const Icon = NAV_ICONS[item.id];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={mobile
        ? cn(
            "flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] text-[10.5px] font-semibold leading-none transition-colors",
            active ? "bg-field text-forest" : "text-paper/85 hover:bg-white/10 hover:text-paper",
          )
        : cn(
            "flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold transition-all duration-150",
            active ? "bg-green-tint text-green" : "text-ink-40 hover:bg-hairline/30 hover:text-forest",
          )}
    >
      <Icon
        className={cn(mobile ? "h-5 w-5" : "h-[18px] w-[18px] shrink-0", !mobile && active && "text-green")}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className={mobile ? "whitespace-nowrap" : ""}>{item.label}</span>
    </Link>
  );
}

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  const navigation = getClientNavigationState(pathname);
  
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
        {CLIENT_PRIMARY_NAV.map((item) => {
          const active = navigation.primaryId === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-semibold transition-all duration-150",
                active ? "bg-green-tint text-green" : "text-ink-40 hover:text-forest hover:bg-hairline/30",
                collapsed && "justify-center px-2",
              )}
            >
              {(() => {
                const Icon = NAV_ICONS[item.id];
                return <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />;
              })()}
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
    <div className={cn("flex h-dvh overflow-hidden font-sans transition-colors duration-300", "bg-paper")}>
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
        <div className="hidden md:flex h-14 items-center justify-between px-7 text-sm font-semibold flex-none" style={{ color: "var(--forest)" }}>
        </div>

        <main className="flex-1 overflow-y-auto px-[22px] md:px-[26px] pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-[26px] pt-3 md:pt-0 mx-auto w-full max-w-[440px] md:max-w-none md:pr-10 lg:pl-10">
          <div className="flex items-center justify-between pb-3 lg:hidden">
            <Link href="/client/dashboard" className="flex items-center gap-2" aria-label="tala home">
              <Sol size="xs" animate="none" />
              <span className="font-display text-[24px] leading-none tracking-[-0.03em] text-forest">tala</span>
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
          </div>

          {navigation.tabs && (
            <nav aria-label={`${navigation.sectionLabel} sections`} className="mb-5 overflow-x-auto">
              <div className="flex w-max min-w-full gap-1 rounded-full border border-hairline bg-surface p-1">
                {navigation.tabs.map((tab) => {
                  const active = navigation.activeTabId === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-4 text-[12px] font-semibold transition-colors sm:px-5 sm:text-[13px]",
                        active ? "bg-forest text-paper" : "text-ink-40 hover:text-forest",
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
          aria-label="Main client navigation"
          data-testid="mobile-client-navigation"
          className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-30 mx-auto flex h-[68px] max-w-[420px] items-center justify-between rounded-[34px] bg-forest px-2 gap-0.5 shadow-[0_10px_30px_rgba(12,33,164,0.25)] lg:hidden"
        >
          {CLIENT_PRIMARY_NAV.slice(0, 3).map((item) => (
            <ClientNavigationLink key={item.id} item={item} active={navigation.primaryId === item.id} mobile />
          ))}
          <button
            type="button"
            onClick={openSolChat}
            aria-label="Ask Sol"
            className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-surface transition-transform hover:scale-105"
          >
            <Sol size="sm" animate="none" />
          </button>
          {CLIENT_PRIMARY_NAV.slice(3).map((item) => (
            <ClientNavigationLink key={item.id} item={item} active={navigation.primaryId === item.id} mobile />
          ))}
        </nav>
      </div>
    </div>
  );
}