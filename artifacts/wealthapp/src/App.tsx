import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useUser } from "@clerk/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useProfile } from "@/hooks/useProfile";
import { useEffect } from "react";

import LandingPage from "@/pages/landing";
import BlogListPage from "@/pages/blog/list";
import BlogPostPage from "@/pages/blog/post";
import ToolsPage from "@/pages/tools";

import FreeDashboard from "@/pages/free/dashboard";
import PathwayPage from "@/pages/free/pathway";
import BudgetPage from "@/pages/free/budget";
import GoalsPage from "@/pages/free/goals";
import NetWorthPage from "@/pages/free/networth";
import HealthScorePage from "@/pages/free/healthscore";

import ClientDashboard from "@/pages/client/dashboard";
import ClientPortfolio from "@/pages/client/portfolio";
import ClientPlan from "@/pages/client/plan";
import ClientGoals from "@/pages/client/goals";
import ClientNetWorth from "@/pages/client/networth";
import ClientDocuments from "@/pages/client/documents";
import ClientMessages from "@/pages/client/messages";

import AdvisorDashboard from "@/pages/advisor/dashboard";
import AdvisorClients from "@/pages/advisor/clients";
import AdvisorClientDetail from "@/pages/advisor/client-detail";
import AdvisorTasks from "@/pages/advisor/tasks";
import AdvisorLeads from "@/pages/advisor/leads";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminBlog from "@/pages/admin/blog";

import NotFound from "@/pages/not-found";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const CLERK_PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

function ProfileSync() {
  const { user, isLoaded } = useUser();
  const { upsert } = useProfile();
  useEffect(() => {
    if (isLoaded && user) {
      upsert.mutate({ email: user.primaryEmailAddress?.emailAddress ?? "", fullName: user.fullName ?? undefined });
    }
  }, [isLoaded, user?.id]);
  return null;
}

function ProtectedRoute({ component: C, role }: { component: React.ComponentType; role?: string[] }) {
  const { isLoaded, isSignedIn } = useUser();
  const { profile, isLoading } = useProfile();
  if (!isLoaded || isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading…</div></div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (role && profile && !role.includes(profile.role)) return <Redirect to="/" />;
  return <C />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/tools" component={ToolsPage} />

      <Route path="/sign-in" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <SignIn routing="path" path={`${BASE}/sign-in`} fallbackRedirectUrl={`${BASE}/dashboard`} />
        </div>
      )} />
      <Route path="/sign-up" component={() => (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <SignUp routing="path" path={`${BASE}/sign-up`} fallbackRedirectUrl={`${BASE}/dashboard`} />
        </div>
      )} />

      <Route path="/dashboard" component={() => <RoleRedirect />} />

      <Route path="/free/dashboard" component={() => <ProtectedRoute component={FreeDashboard} />} />
      <Route path="/free/pathway" component={() => <ProtectedRoute component={PathwayPage} />} />
      <Route path="/free/budget" component={() => <ProtectedRoute component={BudgetPage} />} />
      <Route path="/free/goals" component={() => <ProtectedRoute component={GoalsPage} />} />
      <Route path="/free/networth" component={() => <ProtectedRoute component={NetWorthPage} />} />
      <Route path="/free/health-score" component={() => <ProtectedRoute component={HealthScorePage} />} />

      <Route path="/client/dashboard" component={() => <ProtectedRoute component={ClientDashboard} role={["investment_client"]} />} />
      <Route path="/client/portfolio" component={() => <ProtectedRoute component={ClientPortfolio} role={["investment_client"]} />} />
      <Route path="/client/plan" component={() => <ProtectedRoute component={ClientPlan} role={["investment_client"]} />} />
      <Route path="/client/goals" component={() => <ProtectedRoute component={ClientGoals} role={["investment_client"]} />} />
      <Route path="/client/networth" component={() => <ProtectedRoute component={ClientNetWorth} role={["investment_client"]} />} />
      <Route path="/client/documents" component={() => <ProtectedRoute component={ClientDocuments} role={["investment_client"]} />} />
      <Route path="/client/messages" component={() => <ProtectedRoute component={ClientMessages} role={["investment_client"]} />} />

      <Route path="/advisor/dashboard" component={() => <ProtectedRoute component={AdvisorDashboard} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/clients" component={() => <ProtectedRoute component={AdvisorClients} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/clients/:id" component={() => <ProtectedRoute component={AdvisorClientDetail} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/tasks" component={() => <ProtectedRoute component={AdvisorTasks} role={["advisor", "super_admin"]} />} />
      <Route path="/advisor/leads" component={() => <ProtectedRoute component={AdvisorLeads} role={["advisor", "super_admin"]} />} />

      <Route path="/admin/dashboard" component={() => <ProtectedRoute component={AdminDashboard} role={["super_admin"]} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} role={["super_admin"]} />} />
      <Route path="/admin/blog" component={() => <ProtectedRoute component={AdminBlog} role={["super_admin", "advisor"]} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function RoleRedirect() {
  const { profile, isLoading } = useProfile();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading…</div></div>;
  if (!profile) return <Redirect to="/sign-in" />;
  if (profile.role === "super_admin") return <Redirect to="/admin/dashboard" />;
  if (profile.role === "advisor") return <Redirect to="/advisor/dashboard" />;
  if (profile.role === "investment_client") return <Redirect to="/client/dashboard" />;
  return <Redirect to="/free/dashboard" />;
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PK} afterSignOutUrl={`${BASE}/`}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={BASE}>
            <ProfileSync />
            <Router />
          </WouterRouter>
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
