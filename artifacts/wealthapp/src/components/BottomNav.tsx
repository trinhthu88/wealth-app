import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { cn } from "@/lib/utils";

const TABS = [
  {
    label: "Home",
    href: "/free/dashboard",
    icon: (active: boolean) => (
      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <polyline points="9 21 9 12 15 12 15 21" />
      </svg>
    ),
  },
  {
    label: "Budget",
    href: "/free/budget",
    icon: (active: boolean) => (
      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="8" y2="15" />
      </svg>
    ),
  },
  {
    label: "Goals",
    href: "/free/goals",
    icon: (active: boolean) => (
      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Badges",
    href: "/free/milestones",
    icon: (active: boolean) => (
      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
      </svg>
    ),
  },
];

function Tab({ href, icon, label }: { href: string; icon: (active: boolean) => React.ReactNode; label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href} className="flex-1">
      <div
        className={cn("flex flex-col items-center gap-[5px] pt-2", active ? "text-[#1D9E75]" : "text-[#A8A095]")}
      >
        {icon(active)}
        <span style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, lineHeight: 1 }}>
          {label}
        </span>
      </div>
    </Link>
  );
}

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-stretch md:hidden z-40"
      style={{
        height: 80,
        background: "rgba(250,248,245,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.07)",
      }}
    >
      {TABS.map(tab => (
        <Tab key={tab.href} href={tab.href} icon={tab.icon} label={tab.label} />
      ))}
      {/* Profile tab */}
      <div className="flex-1 flex flex-col items-center gap-[5px] pt-2 text-[#A8A095]">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "!h-[26px] !w-[26px]",
              rootBox: "!block",
              userButtonTrigger: "!focus:shadow-none !outline-none",
            },
          }}
        />
        <span style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, lineHeight: 1 }}>
          Profile
        </span>
      </div>
    </nav>
  );
}
