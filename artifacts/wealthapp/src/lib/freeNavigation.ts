// Free-plan navigation, mirroring the investment client's menu bar:
// Home · Budget · Wealth · (Sol) · Goals · Advisor. Sol sits between Wealth and
// Goals and is rendered by the app shell (it opens the Sol chat, not a route).
// Free users have no advisor yet, so the Advisor place is where they meet one.
export const FREE_PRIMARY_NAV = [
  { id: "home", label: "Home", href: "/free/dashboard" },
  { id: "budget", label: "Budget", href: "/free/budget" },
  { id: "wealth", label: "Wealth", href: "/free/networth" },
  { id: "goals", label: "Goals", href: "/free/goals" },
  { id: "advisor", label: "Advisor", href: "/free/advisor" },
] as const;

export type FreePrimaryNavId = (typeof FREE_PRIMARY_NAV)[number]["id"];

type SectionTab = { id: string; label: string; href: string };

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
  sectionLabel: string | null;
  tabs: readonly SectionTab[] | null;
  activeTabId: string | null;
  /** Sub-pages that open as a card from another place get a back pill instead of tabs. */
  back: { label: string; href: string } | null;
}

export function getFreeNavigationState(location: string): FreeNavigationState {
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  const none = { tabs: null, sectionLabel: null, activeTabId: null, back: null };

  if (pathname === "/free/dashboard") return { ...none, primaryId: "home" };
  if (pathname === "/free/health-score") return { ...none, primaryId: "home", back: { label: "Home", href: "/free/dashboard" } };
  if (pathname === "/free/settings") return { ...none, primaryId: "home", back: { label: "Home", href: "/free/dashboard" } };
  if (pathname === "/free/budget") return { ...none, primaryId: "budget" };
  if (pathname === "/free/advisor") return { ...none, primaryId: "advisor" };

  const section = (primaryId: FreePrimaryNavId, sectionLabel: string, tabs: readonly SectionTab[]): FreeNavigationState => ({
    primaryId, sectionLabel, tabs, back: null,
    activeTabId: tabs.find(t => t.href === pathname)?.id ?? null,
  });
  if (WEALTH_TABS.some(t => t.href === pathname)) return section("wealth", "Wealth", WEALTH_TABS);
  if (GOALS_TABS.some(t => t.href === pathname)) return section("goals", "Goals", GOALS_TABS);

  return { ...none, primaryId: null };
}
