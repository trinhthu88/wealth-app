export const CLIENT_PRIMARY_NAV = [
  { id: "home", label: "Home", href: "/client/dashboard" },
  { id: "money", label: "Money", href: "/client/money" },
  { id: "wealth", label: "Wealth", href: "/client/wealth/overview" },
  { id: "goals", label: "Goals", href: "/client/goals/goals" },
  { id: "advisor", label: "Advisor", href: "/client/advisor/messages" },
] as const;

export type ClientPrimaryNavId = (typeof CLIENT_PRIMARY_NAV)[number]["id"];

const WEALTH_TABS = [
  { id: "overview", label: "Overview", href: "/client/wealth/overview" },
  { id: "investments", label: "Investments", href: "/client/wealth/investments" },
  { id: "property-debts", label: "Property & debts", href: "/client/wealth/property-debts" },
] as const;

const GOALS_TABS = [
  { id: "goals", label: "Goals", href: "/client/goals/goals" },
  { id: "my-plan", label: "My plan", href: "/client/goals/my-plan" },
  { id: "what-if", label: "What-if", href: "/client/goals/what-if" },
] as const;

const ADVISOR_TABS = [
  { id: "messages", label: "Messages", href: "/client/advisor/messages" },
  { id: "documents", label: "Documents", href: "/client/advisor/documents" },
] as const;

type SectionTab = { id: string; label: string; href: string };

export interface ClientNavigationState {
  primaryId: ClientPrimaryNavId | null;
  sectionLabel: string | null;
  tabs: readonly SectionTab[] | null;
  activeTabId: string | null;
}

export function clientPathname(location: string): string {
  return location.split(/[?#]/, 1)[0] || "/";
}

export function getClientNavigationState(location: string): ClientNavigationState {
  const pathname = clientPathname(location);
  let primaryId: ClientPrimaryNavId | null = null;
  let sectionLabel: string | null = null;
  let tabs: readonly SectionTab[] | null = null;
  let activeTabId: string | null = null;

  if (pathname === "/client/dashboard") {
    primaryId = "home";
  } else if (pathname === "/client/money") {
    primaryId = "money";
  } else if (pathname.startsWith("/client/wealth/")) {
    primaryId = "wealth";
    sectionLabel = "Wealth";
    tabs = WEALTH_TABS;
    activeTabId = pathname === "/client/wealth/property-debts"
      ? "property-debts"
      : pathname.startsWith("/client/wealth/investments")
        ? "investments"
        : "overview";
  } else if (pathname.startsWith("/client/goals/")) {
    primaryId = "goals";
    sectionLabel = "Goals";
    tabs = GOALS_TABS;
    activeTabId = pathname === "/client/goals/my-plan"
      ? "my-plan"
      : pathname === "/client/goals/what-if"
        ? "what-if"
        : "goals";
  } else if (pathname.startsWith("/client/advisor/")) {
    primaryId = "advisor";
    sectionLabel = "Advisor";
    tabs = ADVISOR_TABS;
    activeTabId = pathname === "/client/advisor/documents" ? "documents" : "messages";
  }

  return { primaryId, sectionLabel, tabs, activeTabId };
}

export function resolveLegacyClientLocation(location: string): string | null {
  const url = new URL(location, "https://wealthapp.local");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const suffix = `${url.search}${url.hash}`;

  const exactRoutes: Record<string, string> = {
    "/client/portfolio": "/client/wealth/investments",
    "/client/packages": "/client/wealth/investments",
    "/client/transactions": "/client/wealth/investments",
    "/client/networth": "/client/wealth/overview",
    "/client/plan": "/client/goals/my-plan",
    "/client/pathway": "/client/goals/my-plan",
    "/client/goals": "/client/goals/goals",
    "/client/scenarios": "/client/goals/what-if",
    "/client/messages": "/client/advisor/messages",
    "/client/documents": "/client/advisor/documents",
    "/client/budget": "/client/money",
  };

  let target = exactRoutes[pathname];
  const holding = pathname.match(/^\/client\/portfolio\/holding\/([^/]+)$/);
  const fund = pathname.match(/^\/client\/portfolio\/([^/]+)\/funds\/([^/]+)$/);
  const plan = pathname.match(/^\/client\/portfolio\/([^/]+)$/);
  const packageDetail = pathname.match(/^\/client\/packages\/([^/]+)$/);

  if (holding) target = `/client/wealth/investments/holding/${holding[1]}`;
  else if (fund) target = `/client/wealth/investments/${fund[1]}/funds/${fund[2]}`;
  else if (plan) target = `/client/wealth/investments/${plan[1]}`;
  else if (packageDetail) target = `/client/wealth/investments/packages/${packageDetail[1]}`;

  return target ? `${target}${suffix}` : null;
}
