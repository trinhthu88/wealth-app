import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useUser, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useProfile } from "@/hooks/useProfile";
import { setTokenGetter } from "@/lib/api";
import { useEffect, useRef, lazy, Suspense } from "react";
import Sol from "@/components/Sol";

const LandingPage = lazy(() => import("@/pages/landing"));
const BlogListPage = lazy(() => import("@/pages/blog/list"));
const BlogPostPage = lazy(() => import("@/pages/blog/post"));
const ToolsPage = lazy(() => import("@/pages/tools"));

const FreeDashboard = lazy(() => import("@/pages/free/dashboard"));
const PathwayPage = lazy(() => import("@/pages/free/pathway"));
const BudgetPage = lazy(() => import("@/pages/free/budget"));
const GoalsPage = lazy(() => import("@/pages/free/goals"));
const NetWorthPage = lazy(() => import("@/pages/free/networth"));
const HealthScorePage = lazy(() => import("@/pages/free/healthscore"));

const ClientDashboard = lazy(() => import("@/pages/client/dashboard"));
const ClientPortfolio = lazy(() => import("@/pages/client/portfolio"));
const ClientPlan = lazy(() => import("@/pages/client/plan"));
const ClientGoals = lazy(() => import("@/pages/client/goals"));
const ClientNetWorth = lazy(() => import("@/pages/client/networth"));
const ClientDocuments = lazy(() => import("@/pages/client/documents"));
const ClientMessages = lazy(() => import("@/pages/client/messages"));
const ClientOnboarding = lazy(() => import("@/pages/client/onboarding"));
const ClientPackages = lazy(() => import("@/pages/client/packages"));
const ClientPackageDetail = lazy(() => import("@/pages/client/package-detail"));
const ClientTransactions = lazy(() => import("@/pages/client/transactions"));
const ClientScenarios = lazy(() => import("@/pages/client/scenarios"));

const AdvisorDashboard = lazy(() => import("@/pages/advisor/dashboard"));
const AdvisorClients = lazy(() => import("@/pages/advisor/clients"));
const AdvisorClientDetail = lazy(() => import("@/pages/advisor/client-detail"));
const AdvisorTasks = lazy(() => import("@/pages/advisor/tasks"));
const AdvisorLeads = lazy(() => import("@/pages/advisor/leads"));

const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminBlog = lazy(() => import("@/pages/admin/blog"));
const AdminFunds = lazy(() => import("@/pages/admin/funds"));
const AdminClients = lazy(() => import("@/pages/admin/clients"));
const AdminPrices = lazy(() => import("@/pages/admin/prices"));

const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Sol size="md" animate="pulse" />
      <p className="text-sm text-muted-foreground font-medium">Loading…</p>
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
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#1D9E75",
    colorForeground: "#042C53",
    colorMutedForeground: "#64748b",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f8fafc",
    colorInputForeground: "#042C53",
    colorNeutral: "#e2e8f0",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-bold",
    headerSubtitle: "text-slate-500",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "font-medium",
    footerActionLink: "text-[#1D9E75] font-medium",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-[#1D9E75]",
    formFieldSuccessText: "text-[#1D9E75]",
    alertText: "",
    logoBox: "mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-slate-200 hover:bg-slate-50",
    formButtonPrimary: "bg-[#1D9E75] hover:opacity-90 text-white",
    formFieldInput: "border-slate-200 bg-slate-50",
    footerAction: "bg-slate-50",
    dividerLine: "bg-slate-200",
    alert: "",
    otpCodeFieldInput: "border-slate-200",
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
  if (!isLoaded) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Sol size="md" animate="pulse" />
      <p className="text-sm text-muted-foreground font-medium">Loading…</p>
    </div>
  );
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (role && profile && !role.includes(profile.role)) return <Redirect to="/" />;
  return <C />;
}

function RoleRedirect() {
  const { profile, isLoading } = useProfile();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );
  if (!profile) return <Redirect to="/sign-in" />;
  if (profile.role === "super_admin") return <Redirect to="/admin/dashboard" />;
  if (profile.role === "advisor") return <Redirect to="/advisor/dashboard" />;
  if (profile.role === "investment_client") return <Redirect to="/client/dashboard" />;
  return <Redirect to="/free/dashboard" />;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/dashboard`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/dashboard`} />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/tools" component={ToolsPage} />

      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/dashboard" component={() => <RoleRedirect />} />

      <Route path="/free/dashboard" component={() => <ProtectedRoute component={FreeDashboard} />} />
      <Route path="/free/pathway" component={() => <ProtectedRoute component={PathwayPage} />} />
      <Route path="/free/budget" component={() => <ProtectedRoute component={BudgetPage} />} />
      <Route path="/free/goals" component={() => <ProtectedRoute component={GoalsPage} />} />
      <Route path="/free/networth" component={() => <ProtectedRoute component={NetWorthPage} />} />
      <Route path="/free/health-score" component={() => <ProtectedRoute component={HealthScorePage} />} />

      <Route path="/client/onboarding" component={() => <ProtectedRoute component={ClientOnboarding} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/dashboard" component={() => <ProtectedRoute component={ClientDashboard} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/portfolio" component={() => <ProtectedRoute component={ClientPortfolio} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/packages/:id" component={() => <ProtectedRoute component={ClientPackageDetail} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/packages" component={() => <ProtectedRoute component={ClientPackages} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/transactions" component={() => <ProtectedRoute component={ClientTransactions} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/scenarios" component={() => <ProtectedRoute component={ClientScenarios} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/plan" component={() => <ProtectedRoute component={ClientPlan} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/goals" component={() => <ProtectedRoute component={ClientGoals} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/networth" component={() => <ProtectedRoute component={ClientNetWorth} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/documents" component={() => <ProtectedRoute component={ClientDocuments} role={["investment_client", "super_admin"]} />} />
      <Route path="/client/messages" component={() => <ProtectedRoute component={ClientMessages} role={["investment_client", "super_admin"]} />} />

      <Route path="/advisor/dashboard" component={() => <ProtectedRoute component={AdvisorDashboard} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/clients" component={() => <ProtectedRoute component={AdvisorClients} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/clients/:id" component={() => <ProtectedRoute component={AdvisorClientDetail} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/tasks" component={() => <ProtectedRoute component={AdvisorTasks} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/leads" component={() => <ProtectedRoute component={AdvisorLeads} role={["advisor", "super_admin"]} />} />

      <Route path="/admin/dashboard" component={() => <ProtectedRoute component={AdminDashboard} role={["super_admin"]} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} role={["super_admin"]} />} />
      <Route path="/admin/clients" component={() => <ProtectedRoute component={AdminClients} role={["super_admin"]} />} />
      <Route path="/admin/prices" component={() => <ProtectedRoute component={AdminPrices} role={["super_admin"]} />} />
      <Route path="/admin/blog" component={() => <ProtectedRoute component={AdminBlog} role={["super_admin", "advisor"]} />} />
      <Route path="/admin/funds" component={() => <ProtectedRoute component={AdminFunds} role={["super_admin"]} />} />

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
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
          <AppRoutes />
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
