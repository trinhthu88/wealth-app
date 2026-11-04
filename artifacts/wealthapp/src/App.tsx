import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useUser, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useProfile } from "@/hooks/useProfile";
import { useOnboardingStage } from "@/hooks/useClientTrack";
import { resolveRoleRedirectPath } from "@/lib/roleRedirect";
import { resolveLegacyClientLocation } from "@/lib/clientNavigation";
import { setTokenGetter } from "@/lib/api";
import { trackPageView, resetUser } from "@/lib/analytics";
import { useEffect, useRef, lazy, Suspense } from "react";
import Sol from "@/components/Sol";
import FloatingSolChat from "@/components/client/FloatingSolChat";

const LandingPage = lazy(() => import("@/pages/landing"));
const BlogListPage = lazy(() => import("@/pages/blog/list"));
const BlogPostPage = lazy(() => import("@/pages/blog/post"));
const ToolsPage = lazy(() => import("@/pages/tools"));

const BillingSuccess = lazy(() => import("@/pages/billing/success"));
const BillingCancel = lazy(() => import("@/pages/billing/cancel"));

const FreeDashboard = lazy(() => import("@/pages/free/dashboard"));
const PathwayPage = lazy(() => import("@/pages/free/pathway"));
const FreeOnboardingPage = lazy(() => import("@/pages/free/onboarding"));
const BudgetPage = lazy(() => import("@/pages/free/budget"));
const GoalsPage = lazy(() => import("@/pages/free/goals"));
const NetWorthPage = lazy(() => import("@/pages/free/networth"));
const HealthScorePage = lazy(() => import("@/pages/free/healthscore"));
const MilestonesPage = lazy(() => import("@/pages/free/milestones"));
const FreePortfolioPage = lazy(() => import("@/pages/free/portfolio"));
const FreeSettingsPage = lazy(() => import("@/pages/free/settings"));

const ClientDashboard = lazy(() => import("@/pages/client/ClientDashboard"));
const ClientPortfolio = lazy(() => import("@/pages/client/ClientPortfolio"));
const AdvisedPlanDetail = lazy(() => import("@/pages/client/AdvisedPlanDetail"));
const FundDetail = lazy(() => import("@/pages/client/FundDetail"));
const HoldingDetail = lazy(() => import("@/pages/client/HoldingDetail"));
const ClientPlan = lazy(() => import("@/pages/client/plan"));
const ClientGoals = lazy(() => import("@/pages/client/goals"));
const ClientNetWorth = lazy(() => import("@/pages/client/networth"));
const ClientDocuments = lazy(() => import("@/pages/client/documents"));
const ClientMessages = lazy(() => import("@/pages/client/messages"));
const ClientOnboarding = lazy(() => import("@/pages/client/ClientOnboarding"));
const ClientPackageDetail = lazy(() => import("@/pages/client/package-detail"));
const ClientScenarios = lazy(() => import("@/pages/client/ClientScenarios"));
const ClientBudget = lazy(() => import("@/pages/client/budget"));

const AdvisorDashboard = lazy(() => import("@/pages/advisor/dashboard"));
const AdvisorClients = lazy(() => import("@/pages/advisor/clients"));
const AdvisorClientDetail = lazy(() => import("@/pages/advisor/client-detail"));
const AdvisorTasks = lazy(() => import("@/pages/advisor/tasks"));
const AdvisorLeads = lazy(() => import("@/pages/advisor/leads"));
const AdvisorLeadDetail = lazy(() => import("@/pages/advisor/lead-detail"));

const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminBlog = lazy(() => import("@/pages/admin/blog"));
const AdminFunds = lazy(() => import("@/pages/admin/funds"));
const AdminClients = lazy(() => import("@/pages/admin/clients"));
const AdminLeads = lazy(() => import("@/pages/admin/leads"));
const AdminPrices = lazy(() => import("@/pages/admin/prices"));
const AdminBenchmarks = lazy(() => import("@/pages/admin/benchmarks"));

const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-paper">
      <Sol size="md" animate="breathe" />
      <p className="text-sm text-ink-40 font-medium">Loading…</p>
    </div>
  );
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "#0C21A4", // green
    colorForeground: "#0C21A4", // forest
    colorMutedForeground: "#7A8B82", // ink-40
    colorDanger: "#FF891F", // clay
    colorBackground: "#FFFEFD", // paper
    colorInput: "#FFFFFF", // surface
    colorInputForeground: "#0C21A4", // forest
    colorNeutral: "#F2E9DB", // hairline
    fontFamily: "Figtree, sans-serif",
    borderRadius: "26px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-surface rounded-[32px] w-[440px] max-w-full overflow-hidden shadow-[0_2px_14px_rgba(12,33,164,0.06)] border-0",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none p-6 md:p-8",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-display font-semibold text-[30px] tracking-[-0.02em]",
    headerSubtitle: "text-ink-40 text-[14px]",
    socialButtonsBlockButtonText: "font-semibold text-[15px]",
    formFieldLabel: "font-semibold text-[15px] text-forest",
    footerActionLink: "text-green font-semibold",
    footerActionText: "text-ink-40",
    dividerText: "text-ink-40",
    identityPreviewEditButton: "text-green",
    formFieldSuccessText: "text-green",
    alertText: "",
    logoBox: "mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "border-hairline hover:bg-hairline/50 rounded-2xl h-12",
    formButtonPrimary: "bg-green hover:bg-forest text-white rounded-2xl h-12 font-semibold text-[15px] transition-colors",
    formFieldInput: "border-hairline bg-surface rounded-xl h-12 px-4 focus:ring-green focus:border-green",
    footerAction: "bg-surface pt-4 border-t border-hairline",
    dividerLine: "bg-hairline",
    alert: "",
    otpCodeFieldInput: "border-hairline rounded-xl",
    formFieldRow: "",
    main: "",
  },
};

function ClerkTokenSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);
  return null;
}

function ProfileSync() {
  const { user, isLoaded } = useUser();
  const { upsert } = useProfile();
  useEffect(() => {
    if (isLoaded && user) {
      upsert.mutate({
        email: user.primaryEmailAddress?.emailAddress ?? "",
        fullName: user.fullName ?? undefined,
      });
    }
  }, [isLoaded, user?.id]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
        if (userId === null) resetUser();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function ProtectedRoute({ component: C, role }: { component: React.ComponentType; role?: string[] }) {
  const { isLoaded, isSignedIn } = useUser();
  const { profile } = useProfile();
  if (!isLoaded) return <PageLoader />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (role && profile && !role.includes(profile.role)) return <Redirect to="/" />;
  return <C />;
}

function RoleRedirect() {
  const { profile, isLoading } = useProfile();
  const usesClientScreens = profile?.role === "investment_client" || profile?.role === "free_user";
  const { onboardingStage, isLoading: trackLoading } = useOnboardingStage(usesClientScreens);

  if (isLoading || trackLoading) return <PageLoader />;
  if (!profile) return <Redirect to="/sign-in" />;
  return <Redirect to={resolveRoleRedirectPath(profile.role, onboardingStage)} />;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/dashboard`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/dashboard`} />
    </div>
  );
}

function LegacyClientRedirect() {
  const [location, navigate] = useLocation();
  const target = resolveLegacyClientLocation(
    `${location.split(/[?#]/, 1)[0]}${window.location.search}${window.location.hash}`,
  );

  useEffect(() => {
    if (target) navigate(target, { replace: true });
  }, [navigate, target]);

  return target ? null : <NotFound />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/tools" component={ToolsPage} />

      <Route path="/billing/success" component={BillingSuccess} />
      <Route path="/billing/cancel" component={BillingCancel} />

      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/dashboard" component={() => <RoleRedirect />} />

      <Route path="/free/dashboard" component={() => <ProtectedRoute component={FreeDashboard} />} />
      <Route path="/free/onboarding" component={() => <ProtectedRoute component={FreeOnboardingPage} />} />
      <Route path="/free/pathway" component={() => <ProtectedRoute component={PathwayPage} />} />
      <Route path="/free/budget" component={() => <ProtectedRoute component={BudgetPage} />} />
      <Route path="/free/goals" component={() => <ProtectedRoute component={GoalsPage} />} />
      <Route path="/free/networth" component={() => <ProtectedRoute component={NetWorthPage} />} />
      <Route path="/free/health-score" component={() => <ProtectedRoute component={HealthScorePage} />} />
      <Route path="/free/milestones" component={() => <ProtectedRoute component={MilestonesPage} />} />
      <Route path="/free/portfolio" component={() => <ProtectedRoute component={FreePortfolioPage} />} />
      <Route path="/free/settings" component={() => <ProtectedRoute component={FreeSettingsPage} />} />

      <Route path="/client/onboarding" component={() => <ProtectedRoute component={ClientOnboarding} />} />
      <Route path="/client/dashboard" component={() => <ProtectedRoute component={ClientDashboard} />} />
      <Route path="/client/money" component={() => <ProtectedRoute component={ClientBudget} />} />
      <Route path="/client/wealth" component={() => <Redirect to="/client/wealth/overview" />} />
      <Route path="/client/wealth/overview" component={() => <ProtectedRoute component={ClientNetWorth} />} />
      <Route path="/client/wealth/property-debts" component={() => <ProtectedRoute component={ClientNetWorth} />} />
      <Route path="/client/wealth/investments" component={() => <ProtectedRoute component={ClientPortfolio} />} />
      <Route path="/client/wealth/investments/holding/:holdingId" component={() => <ProtectedRoute component={HoldingDetail} />} />
      <Route path="/client/wealth/investments/:planId/funds/:fundCode" component={() => <ProtectedRoute component={FundDetail} />} />
      <Route path="/client/wealth/investments/packages/:id" component={() => <ProtectedRoute component={ClientPackageDetail} />} />
      <Route path="/client/wealth/investments/:planId" component={() => <ProtectedRoute component={AdvisedPlanDetail} />} />
      <Route path="/client/goals/goals" component={() => <ProtectedRoute component={ClientGoals} />} />
      <Route path="/client/goals/my-plan" component={() => <ProtectedRoute component={ClientPlan} />} />
      <Route path="/client/goals/what-if" component={() => <ProtectedRoute component={ClientScenarios} />} />
      <Route path="/client/advisor/messages" component={() => <ProtectedRoute component={ClientMessages} />} />
      <Route path="/client/advisor/documents" component={() => <ProtectedRoute component={ClientDocuments} />} />

      {/* Legacy client links redirect to their new place and retain query strings. */}
      <Route path="/client/portfolio/holding/:holdingId" component={LegacyClientRedirect} />
      <Route path="/client/portfolio/:planId/funds/:fundCode" component={LegacyClientRedirect} />
      <Route path="/client/portfolio/:planId" component={LegacyClientRedirect} />
      <Route path="/client/portfolio" component={LegacyClientRedirect} />
      <Route path="/client/packages/:id" component={LegacyClientRedirect} />
      <Route path="/client/packages" component={LegacyClientRedirect} />
      <Route path="/client/transactions" component={LegacyClientRedirect} />
      <Route path="/client/networth" component={LegacyClientRedirect} />
      <Route path="/client/plan" component={LegacyClientRedirect} />
      <Route path="/client/pathway" component={LegacyClientRedirect} />
      <Route path="/client/goals" component={LegacyClientRedirect} />
      <Route path="/client/scenarios" component={LegacyClientRedirect} />
      {/* Wealth Score is now a home-screen card + bottom sheet only (no standalone page). */}
      <Route path="/client/health-score" component={() => <Redirect to="/client/dashboard" />} />
      <Route path="/client/documents" component={LegacyClientRedirect} />
      <Route path="/client/budget" component={LegacyClientRedirect} />
      <Route path="/client/messages" component={LegacyClientRedirect} />

      <Route path="/advisor/dashboard" component={() => <ProtectedRoute component={AdvisorDashboard} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/clients" component={() => <ProtectedRoute component={AdvisorClients} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/clients/:id" component={() => <ProtectedRoute component={AdvisorClientDetail} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/tasks" component={() => <ProtectedRoute component={AdvisorTasks} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/leads" component={() => <ProtectedRoute component={AdvisorLeads} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/leads/:id" component={() => <ProtectedRoute component={AdvisorLeadDetail} role={["advisor", "super_admin"]} />} />

      <Route path="/admin/dashboard" component={() => <ProtectedRoute component={AdminDashboard} role={["super_admin"]} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} role={["super_admin"]} />} />
      <Route path="/admin/clients" component={() => <ProtectedRoute component={AdminClients} role={["super_admin"]} />} />
      <Route path="/admin/leads" component={() => <ProtectedRoute component={AdminLeads} role={["super_admin"]} />} />
      <Route path="/admin/prices" component={() => <ProtectedRoute component={AdminPrices} role={["super_admin"]} />} />
      <Route path="/admin/benchmarks" component={() => <ProtectedRoute component={AdminBenchmarks} role={["super_admin"]} />} />
      <Route path="/admin/blog" component={() => <ProtectedRoute component={AdminBlog} role={["super_admin", "advisor"]} />} />
      <Route path="/admin/funds" component={() => <ProtectedRoute component={AdminFunds} role={["super_admin"]} />} />

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function ClientRouteLayer() {
  const [location] = useLocation();
  const { profile } = useProfile();
  const isClientPage = location.startsWith("/client/");

  return (
    <>
      <AppRoutes />
      {(profile?.role === "investment_client" || profile?.role === "free_user") && isClientPage && (
        <FloatingSolChat isOnboarding={location.split(/[?#]/, 1)[0] === "/client/onboarding"} />
      )}
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    trackPageView(location);
  }, [location]);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={basePath || "/"}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkTokenSync />
        <ClerkQueryClientCacheInvalidator />
        <ProfileSync />
        <TooltipProvider>
          <ClientRouteLayer />
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
