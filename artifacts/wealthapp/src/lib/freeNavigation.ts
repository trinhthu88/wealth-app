// Free-plan navigation, mirroring the investment client's menu bar:
// Home · Wealth · Sol · Goals · More. Sol sits between Wealth and Goals and is
// rendered by the app shell (it opens the Sol chat, it is not a route).
// Budget and Health score live under Home — they open from the dashboard cards.
export const FREE_PRIMARY_NAV = [
  { id: "home", label: "Home", href: "/free/dashboard" },
  { id: "wealth", label: "Wealth", href: "/free/networth" },
  { id: "goals", label: "Goals", href: "/free/goals" },
  { id: "more", label: "More", href: "/free/settings" },
] as const;

export type FreePrimaryNavId = (typeof FREE_PRIMARY_NAV)[number]["id"];

type SectionTab = { id: string; label: string; href: string };

const HOME_TABS: readonly SectionTab[] = [
  { id: "overview", label: "Overview", href: "/free/dashboard" },
  { id: "budget", label: "Budget", href: "/free/budget" },
  { id: "health", label: "Health score", href: "/free/health-score" },
];

const WEALTH_TABS: readonly SectionTab[] = [
  { id: "networth", label: "Net worth", href: "/free/networth" },
  { id: "portfolio", label: "Portfolio", href: "/free/portfolio" },
];

const GOALS_TABS: readonly SectionTab[] = [
  { id: "goals", label: "Goals", href: "/free/goals" },
  { id: "pathway", label: "Pathway", href: "/free/pathway" },
  { id: "milestones", label: "Milestones", href: "/free/milestones" },
];

export interface FreeNavigationState {
  primaryId: FreePrimaryNavId | null;
  tabs: readonly SectionTab[] | null;
  sectionLabel: string | null;
  activeTabId: string | null;
}

export function getFreeNavigationState(location: string): FreeNavigationState {
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  const pick = (primaryId: FreePrimaryNavId, sectionLabel: string, tabs: readonly SectionTab[]): FreeNavigationState => ({
    primaryId,
    sectionLabel,
    tabs,
    activeTabId: tabs.find(t => t.href === pathname)?.id ?? null,
  });

  if (HOME_TABS.some(t => t.href === pathname)) return pick("home", "Home", HOME_TABS);
  if (WEALTH_TABS.some(t => t.href === pathname)) return pick("wealth", "Wealth", WEALTH_TABS);
  if (GOALS_TABS.some(t => t.href === pathname)) return pick("goals", "Goals", GOALS_TABS);
  if (pathname === "/free/settings") return { primaryId: "more", sectionLabel: null, tabs: null, activeTabId: null };
  return { primaryId: null, sectionLabel: null, tabs: null, activeTabId: null };
}
