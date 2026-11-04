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
import { CLIENT_SCREEN_ROLES } from "@/lib/clientRoutes";
import { useEntitlements } from "@/hooks/useEntitlements";
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
const FreeAdvisorPage = lazy(() => import("@/pages/free/advisor"));

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
const ActivateMembership = lazy(() => import("@/pages/client/ActivateMembership"));
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
const AdminMembership = lazy(() => import("@/pages/admin/membership"));

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
  const { entitlements, isLoading: entitlementsLoading } = useEntitlements();

  if (isLoading || trackLoading || entitlementsLoading) return <PageLoader />;
  if (!profile) return <Redirect to="/sign-in" />;
  return <Redirect to={resolveRoleRedirectPath(profile.role, onboardingStage, !!entitlements?.membership.pendingPayment)} />;
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

// Routes take their element as children, never an inline component function, which is a new
// component type on every render, so any re-render here (ClientRouteLayer re-renders on each
// profile change) would remount the whole page and lose its state, such as the onboarding step.
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

      <Route path="/dashboard"><RoleRedirect /></Route>

      <Route path="/free/dashboard"><ProtectedRoute component={FreeDashboard} role={["free_user"]} /></Route>
      <Route path="/free/onboarding"><ProtectedRoute component={FreeOnboardingPage} role={["free_user"]} /></Route>
      <Route path="/free/pathway"><ProtectedRoute component={PathwayPage} role={["free_user"]} /></Route>
      <Route path="/free/budget"><ProtectedRoute component={BudgetPage} role={["free_user"]} /></Route>
      <Route path="/free/goals"><ProtectedRoute component={GoalsPage} role={["free_user"]} /></Route>
      <Route path="/free/networth"><ProtectedRoute component={NetWorthPage} role={["free_user"]} /></Route>
      <Route path="/free/health-score"><ProtectedRoute component={HealthScorePage} role={["free_user"]} /></Route>
      <Route path="/free/milestones"><ProtectedRoute component={MilestonesPage} role={["free_user"]} /></Route>
      <Route path="/free/portfolio"><ProtectedRoute component={FreePortfolioPage} role={["free_user"]} /></Route>
      <Route path="/free/settings"><ProtectedRoute component={FreeSettingsPage} role={["free_user"]} /></Route>
      <Route path="/free/advisor"><ProtectedRoute component={FreeAdvisorPage} role={["free_user"]} /></Route>

      {/* Unknown legacy free links return to the role-aware dashboard. */}
      <Route path="/free/*?"><Redirect to="/dashboard" /></Route>

      <Route path="/client/activate"><ProtectedRoute component={ActivateMembership} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/onboarding"><ProtectedRoute component={ClientOnboarding} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/dashboard"><ProtectedRoute component={ClientDashboard} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/money"><ProtectedRoute component={ClientBudget} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/wealth"><Redirect to="/client/wealth/overview" /></Route>
      <Route path="/client/wealth/overview"><ProtectedRoute component={ClientNetWorth} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/wealth/property-debts"><ProtectedRoute component={ClientNetWorth} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/wealth/investments"><ProtectedRoute component={ClientPortfolio} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/wealth/investments/holding/:holdingId"><ProtectedRoute component={HoldingDetail} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/wealth/investments/:planId/funds/:fundCode"><ProtectedRoute component={FundDetail} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/wealth/investments/packages/:id"><ProtectedRoute component={ClientPackageDetail} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/wealth/investments/:planId"><ProtectedRoute component={AdvisedPlanDetail} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/goals/goals"><ProtectedRoute component={ClientGoals} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/goals/my-plan"><ProtectedRoute component={ClientPlan} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/goals/what-if"><ProtectedRoute component={ClientScenarios} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/advisor/messages"><ProtectedRoute component={ClientMessages} role={CLIENT_SCREEN_ROLES} /></Route>
      <Route path="/client/advisor/documents"><ProtectedRoute component={ClientDocuments} role={CLIENT_SCREEN_ROLES} /></Route>

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
      <Route path="/client/health-score"><Redirect to="/client/dashboard" /></Route>
      <Route path="/client/documents" component={LegacyClientRedirect} />
      <Route path="/client/budget" component={LegacyClientRedirect} />
      <Route path="/client/messages" component={LegacyClientRedirect} />

      <Route path="/advisor/dashboard"><ProtectedRoute component={AdvisorDashboard} role={["advisor", "super_admin"]} /></Route>
      <Route path="/advisor/clients"><ProtectedRoute component={AdvisorClients} role={["advisor", "super_admin"]} /></Route>
      <Route path="/advisor/clients/:id"><ProtectedRoute component={AdvisorClientDetail} role={["advisor", "super_admin"]} /></Route>
      <Route path="/advisor/tasks"><ProtectedRoute component={AdvisorTasks} role={["advisor", "super_admin"]} /></Route>
      <Route path="/advisor/leads"><ProtectedRoute component={AdvisorLeads} role={["advisor", "super_admin"]} /></Route>
      <Route path="/advisor/leads/:id"><ProtectedRoute component={AdvisorLeadDetail} role={["advisor", "super_admin"]} /></Route>

      <Route path="/admin/dashboard"><ProtectedRoute component={AdminDashboard} role={["super_admin"]} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} role={["super_admin"]} /></Route>
      <Route path="/admin/clients"><ProtectedRoute component={AdminClients} role={["super_admin"]} /></Route>
      <Route path="/admin/leads"><ProtectedRoute component={AdminLeads} role={["super_admin"]} /></Route>
      <Route path="/admin/prices"><ProtectedRoute component={AdminPrices} role={["super_admin"]} /></Route>
      <Route path="/admin/benchmarks"><ProtectedRoute component={AdminBenchmarks} role={["super_admin"]} /></Route>
      <Route path="/admin/blog"><ProtectedRoute component={AdminBlog} role={["super_admin", "advisor"]} /></Route>
      <Route path="/admin/funds"><ProtectedRoute component={AdminFunds} role={["super_admin"]} /></Route>
      <Route path="/admin/membership"><ProtectedRoute component={AdminMembership} role={["super_admin"]} /></Route>

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function ClientRouteLayer() {
  const [location] = useLocation();
  const { profile } = useProfile();
  const isClientPage = location.startsWith("/client/");
  // Free screens inside the app shell (onboarding is a standalone flow).
  const isFreeShellPage = location.startsWith("/free/") && !location.startsWith("/free/onboarding");

  return (
    <>
      <AppRoutes />
      {(profile?.role === "investment_client" || profile?.role === "free_user") && isClientPage && (
        <FloatingSolChat isOnboarding={location.split(/[?#]/, 1)[0] === "/client/onboarding"} />
      )}
      {profile?.role === "free_user" && isFreeShellPage && <FloatingSolChat />}
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
