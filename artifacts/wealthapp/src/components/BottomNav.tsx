import { Link, useLocation, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Drawer } from "vaul";
import { BarChart3, Briefcase, HeartPulse, LayoutDashboard, Map, MoreHorizontal, Settings, Target, Wallet } from "lucide-react";

// Mirrors the investment client's 5-slot mobile bottom nav (Home, Portfolio,
// Goals, Budget, More) — Pathway/Net Worth/Health Score/Settings live in More.
const TABS = [
  { label: "Home",      href: "/free/dashboard", icon: LayoutDashboard },
  { label: "Portfolio", href: "/free/portfolio", icon: Briefcase },
  { label: "Goals",     href: "/free/goals",     icon: Target },
  { label: "Budget",    href: "/free/budget",    icon: Wallet },
];

const MORE_ITEMS = [
  { label: "Pathway",     href: "/free/pathway",      icon: Map },
  { label: "Net worth",   href: "/free/networth",     icon: BarChart3 },
  { label: "Health score", href: "/free/health-score", icon: HeartPulse },
  { label: "Settings",    href: "/free/settings",     icon: Settings },
];

function Tab({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const [active] = useRoute(href);
  return (
    <Link href={href} className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer" aria-current={active ? "page" : undefined}>
      <Icon className={cn("h-[22px] w-[22px]", active ? "text-green" : "text-ink-20")} strokeWidth={active ? 2.3 : 2} aria-hidden="true" />
      <span className={cn("text-[11.5px] font-semibold", active ? "text-green" : "text-ink-20")}>
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [location] = useLocation();

  const isMoreRoute = MORE_ITEMS.some(item => item.href === location);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-surface border-t border-hairline-2 h-[88px]"
      >
        <div className="flex items-start justify-around pt-3 h-full pb-[env(safe-area-inset-bottom)]">
          {TABS.map(tab => (
            <Tab key={tab.href} href={tab.href} label={tab.label} icon={tab.icon} />
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer outline-none"
            aria-label="Open more navigation"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className={cn("h-[22px] w-[22px]", moreOpen || isMoreRoute ? "text-green" : "text-ink-20")} aria-hidden="true" />
            <span className={cn("text-[11.5px] font-semibold", moreOpen || isMoreRoute ? "text-green" : "text-ink-20")}>More</span>
          </button>
        </div>
      </nav>

      <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-forest/40 z-50 backdrop-blur-sm" />
          <Drawer.Content className="bg-paper rounded-t-[32px] max-h-[82vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none max-w-[440px] mx-auto">
            <Drawer.Title className="sr-only">More navigation</Drawer.Title>
            <Drawer.Description className="sr-only">
              Open your pathway, net worth, health score, or settings.
            </Drawer.Description>
            <div className="overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom))]">
              <div className="mx-auto my-4 h-1.5 w-12 rounded-full bg-hairline" />
              <div className="flex items-center gap-3 rounded-[22px] border border-hairline bg-surface p-4">
                <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
                <div>
                  <p className="text-[15px] font-semibold text-forest">Your TALA workspace</p>
                  <p className="text-[13px] text-ink-40">More tools and progress</p>
                </div>
              </div>
              <nav aria-label="More free destinations" className="mt-4 grid grid-cols-2 gap-2">
                {MORE_ITEMS.map(item => {
                  const Icon = item.icon;
                  const active = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-[18px] border px-3.5 py-3 text-[14px] font-semibold",
                        active ? "border-green/20 bg-green-tint text-green" : "border-hairline bg-surface text-ink-60 hover:text-forest",
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
    </>
  );
}
