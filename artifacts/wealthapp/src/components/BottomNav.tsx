import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { cn } from "@/lib/utils";
import SolChat from "./SolChat";
import { useState } from "react";
import { Drawer } from "vaul";

const TABS = [
  { label: "Home", href: "/free/dashboard" },
  { label: "Plan", href: "/free/pathway" },
  // Sol goes in the middle
  { label: "Goals", href: "/free/goals" },
  { label: "More", href: "/free/budget" }, // or just a placeholder for the more menu
];

function TabIcon({ active, label }: { active: boolean; label: string }) {
  // We can use simplified shapes for the icons based on the design
  const strokeColor = active ? "var(--green)" : "var(--ink-20)";
  const strokeW = active ? 2.5 : 2;
  
  if (label === "Home") {
    return (
      <div className={cn("w-[22px] h-[22px] rounded-[7px]", active ? "bg-green" : "border-2 border-ink-20")} />
    );
  } else if (label === "Plan") {
    return (
      <div className={cn("w-[22px] h-[22px] rounded-[7px]", active ? "bg-green" : "border-2 border-ink-20")} />
    );
  } else if (label === "Goals") {
    return (
      <div className={cn("w-[22px] h-[22px] rounded-full", active ? "bg-green" : "border-2 border-ink-20")} />
    );
  } else {
    // More
    return (
      <div className={cn("w-[22px] h-[22px] rounded-[3px]", active ? "bg-green" : "border-2 border-ink-20")} />
    );
  }
}

function Tab({ href, label }: { href: string; label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href} className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer" aria-current={active ? "page" : undefined}>
      <TabIcon active={active} label={label} />
      <span className={cn("text-[11.5px] font-semibold", active ? "text-green" : "text-ink-20")}>
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const [solOpen, setSolOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-surface border-t border-hairline-2 h-[88px]"
      >
        <div className="flex items-start justify-around pt-3 h-full pb-[env(safe-area-inset-bottom)]">
          <Tab href={TABS[0].href} label={TABS[0].label} />
          <Tab href={TABS[1].href} label={TABS[1].label} />
          
          <button 
            onClick={() => setSolOpen(true)}
            className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer -mt-1.5"
            aria-label="Talk to Sol"
          >
            <div className="w-[34px] h-[34px] rounded-full bg-sun flex items-center justify-center shadow-[0_2px_8px_rgba(255,182,39,0.4)]">
              <div className="w-[12px] h-[12px] rounded-full bg-paper" />
            </div>
            <span className="text-[11.5px] font-semibold text-sun-deep">Sol</span>
          </button>

          <Tab href={TABS[2].href} label={TABS[2].label} />
          
          <div className="flex flex-col items-center gap-[5px] flex-1 cursor-pointer">
             <UserButton
              appearance={{
                elements: {
                  avatarBox: "!w-[22px] !h-[22px] !rounded-[3px]",
                  rootBox: "!block",
                  userButtonTrigger: "!focus:shadow-none !outline-none",
                },
              }}
            />
            <span className="text-[11.5px] font-semibold text-ink-20">Profile</span>
          </div>
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
    </>
  );
}