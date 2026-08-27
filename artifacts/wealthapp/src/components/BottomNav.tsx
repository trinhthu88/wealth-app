import { Link, useLocation, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { cn } from "@/lib/utils";
import SolChat from "./SolChat";
import { useState } from "react";
import { Drawer } from "vaul";
import { BarChart3, HeartPulse, LayoutDashboard, Map, MoreHorizontal, Target, Wallet } from "lucide-react";

const TABS = [
  { label: "Home", href: "/free/dashboard", icon: LayoutDashboard },
  { label: "Pathway", href: "/free/pathway", icon: Map },
  { label: "Goals", href: "/free/goals", icon: Target },
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
  const [solOpen, setSolOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [location] = useLocation();

  const moreItems = [
    { label: "Budget", href: "/free/budget", icon: Wallet },
    { label: "Net worth", href: "/free/networth", icon: BarChart3 },
    { label: "Health score", href: "/free/health-score", icon: HeartPulse },
    { label: "Milestones", href: "/free/milestones", icon: Target },
  ];

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-surface border-t border-hairline-2 h-[88px]"
      >
        <div className="flex items-start justify-around pt-3 h-full pb-[env(safe-area-inset-bottom)]">
          <Tab href={TABS[0].href} label={TABS[0].label} icon={TABS[0].icon} />
          <Tab href={TABS[1].href} label={TABS[1].label} icon={TABS[1].icon} />
          
          <button 
            onClick={() => setSolOpen(true)}
            className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer -mt-1.5"
            aria-label="Talk to Sol"
          >
            <div className="w-[34px] h-[34px] rounded-full bg-sun flex items-center justify-center shadow-[0_2px_8px_rgba(255,182,39,0.4)]">
              <div className="w-[12px] h-[12px] rounded-full bg-sun-ink/80" />
            </div>
            <span className="text-[11.5px] font-semibold text-sun-deep">Sol</span>
          </button>

          <Tab href={TABS[2].href} label={TABS[2].label} icon={TABS[2].icon} />
          
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer outline-none"
            aria-label="Open more navigation"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className={cn("h-[22px] w-[22px]", moreOpen || moreItems.some(item => item.href === location) ? "text-green" : "text-ink-20")} aria-hidden="true" />
            <span className={cn("text-[11.5px] font-semibold", moreOpen || moreItems.some(item => item.href === location) ? "text-green" : "text-ink-20")}>More</span>
          </button>
        </div>
      </nav>

      <Drawer.Root open={solOpen} onOpenChange={setSolOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-forest/40 z-50 backdrop-blur-sm" />
          <Drawer.Content className="bg-paper flex flex-col rounded-t-[32px] h-[80vh] mt-24 fixed bottom-0 left-0 right-0 z-50 focus:outline-none">
            <Drawer.Title className="sr-only">Talk to Sol</Drawer.Title>
            <Drawer.Description className="sr-only">
              Ask TALA's financial coach about your pathway, goals, or financial health.
            </Drawer.Description>
            <div className="pt-4 bg-paper rounded-t-[32px] flex-1 flex flex-col min-h-0">
              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-hairline mb-8" />
              <SolChat
                open={solOpen}
                greeting="Hello! I'm Sol. I'm here to help you model your pathway, update your goals, or just chat about your financial health. What's on your mind?"
              />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-forest/40 z-50 backdrop-blur-sm" />
          <Drawer.Content className="bg-paper rounded-t-[32px] max-h-[82vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none max-w-[440px] mx-auto">
            <Drawer.Title className="sr-only">More free tools</Drawer.Title>
            <Drawer.Description className="sr-only">
              Open your budget, net worth, health score, or milestones.
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
                {moreItems.map(item => {
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