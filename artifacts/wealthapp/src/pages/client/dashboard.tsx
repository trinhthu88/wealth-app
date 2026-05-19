import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { TrendingUp, Target, ArrowRight, MessageSquare, Play, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { fmtCurrency } from "@/lib/portfolioCalculations";

interface ClientProfile {
  id: string;
  status: string;
  prospectOnboardingComplete: boolean;
  onboardingStep: number;
  indicativeAmount: string | null;
  investmentStyle: string | null;
  riskProfile: string | null;
}

interface PackageSummary {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  latestSnapshot: { totalValueUsd: string; totalInvestedUsd: string; totalReturnPercent: string } | null;
}

interface Goal {
  id: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate: string | null;
  status: string;
}

interface Transaction {
  id: string;
  transactionDate: string;
  transactionType: string;
  amountUsd: string;
  package?: { nickname: string; type: string };
  fund?: { name: string };
}

interface Scenario {
  id: string;
  isAdvisorPushed: boolean;
  advisorNote: string | null;
  status: string;
  createdAt: string;
}

const TX_TYPE_LABELS: Record<string, string> = {
  initial_investment: "Initial investment",
  monthly_contribution: "Monthly contribution",
  top_up: "Top up",
  withdrawal: "Withdrawal",
  dividend_reinvested: "Dividend reinvested",
  fee_charged: "Fee charged",
  rebalance: "Rebalance",
};

const GOAL_EMOJIS: Record<string, string> = {
  retire: "🌴", property: "🏠", education: "📚", fire: "🚀",
  business: "💼", emigrate: "🌍", wealth: "💰", early_retire: "🎓",
};

export default function ClientDashboard() {
  const { profile } = useProfile();
  const [, navigate] = useLocation();
  const firstName = profile?.fullName?.split(" ")[0] ?? "there";

  const { data: clientProfile, isLoading } = useQuery<ClientProfile>({
    queryKey: ["client-profile-me"],
    queryFn: () => apiFetch("/client-profile/me"),
  });

  const { data: packages = [] } = useQuery<PackageSummary[]>({
    queryKey: ["my-packages"],
    queryFn: () => apiFetch("/packages"),
    enabled: clientProfile?.status === "active" || clientProfile?.status === "active_prospect",
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch("/goals"),
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions-all"],
    queryFn: () => apiFetch("/transactions/all"),
    enabled: clientProfile?.status === "active" || clientProfile?.status === "active_prospect",
  });

  const { data: scenarios = [] } = useQuery<Scenario[]>({
    queryKey: ["scenarios"],
    queryFn: () => apiFetch("/scenarios"),
    enabled: clientProfile?.status === "active" || clientProfile?.status === "active_prospect",
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-48">
          <div className="animate-pulse text-muted-foreground text-sm">Loading your portal…</div>
        </div>
      </AppShell>
    );
  }

  if (!clientProfile?.prospectOnboardingComplete) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy mb-2">Welcome, {firstName}!</h1>
            <p className="text-muted-foreground">Let's set up your investment profile so your advisor can personalise everything for you.</p>
          </div>
          <Button onClick={() => navigate("/client/onboarding")} size="lg" className="w-full">
            Get started →
          </Button>
        </div>
      </AppShell>
    );
  }

  return <ActiveDashboard firstName={firstName} packages={packages} goals={goals} transactions={transactions} scenarios={scenarios} />;
}

function ActiveDashboard({ firstName, packages, goals, transactions, scenarios }: { firstName: string; packages: PackageSummary[]; goals: Goal[]; transactions: Transaction[]; scenarios: Scenario[] }) {
  const [, navigate] = useLocation();

  const totalValue = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"), 0);
  const totalInvested = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalInvestedUsd ?? "0"), 0);
  const totalReturn = totalValue - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

  const advisorPushed = scenarios.find((s) => s.isAdvisorPushed && s.status === "viewed");

  return (
    <AppShell>
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-navy">Welcome back, {firstName}!</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#042C53 0%,#0a4a8a 100%)" }}>
          <div className="text-xs text-slate-300 mb-1">Total Portfolio Value</div>
          <div className="text-3xl font-bold mb-1">{fmtCurrency(totalValue)}</div>
          <div className={`text-sm mb-3 ${totalReturn >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {totalReturn >= 0 ? "▲" : "▼"} {fmtCurrency(Math.abs(totalReturn))} ({totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(1)}%) total return
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Invested: {fmtCurrency(totalInvested)}</span>
            <Link href="/client/portfolio" className="text-white font-medium flex items-center gap-1 hover:opacity-80">
              View Portfolio <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        {goals.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Goals at a Glance</h3>
              <Link href="/client/goals" className="text-xs text-primary">View all</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
              {goals.map((g) => {
                const target = parseFloat(g.targetAmount ?? "0");
                const current = parseFloat(g.currentAmount ?? "0");
                const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
                const emoji = GOAL_EMOJIS[g.goalType ?? ""] ?? "🎯";
                const onTrack = g.status === "on_track" || pct >= 50;
                return (
                  <div key={g.id} className="shrink-0 w-44 bg-card border border-card-border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="text-xs font-medium truncate">{g.title}</span>
                    </div>
                    <div className="text-base font-bold">{Math.round(pct)}%</div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 mb-1">
                      <div className="h-1.5 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${onTrack ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {onTrack ? "On track" : "Behind"}
                      </span>
                      {g.targetDate && <span className="text-xs text-muted-foreground">{g.targetDate.slice(0, 7)}</span>}
                    </div>
                  </div>
                );
              })}
              <Link href="/client/goals" className="shrink-0 w-36 bg-card border border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40">
                <Plus className="h-5 w-5" />
                <span className="text-xs">Add goal</span>
              </Link>
            </div>
          </motion.div>
        )}

        {packages.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">My Packages</h3>
              <Link href="/client/portfolio" className="text-xs text-primary">View all</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
              {packages.map((pkg) => {
                const value = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
                const invested = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
                const ret = value - invested;
                const retPct = invested > 0 ? (ret / invested) * 100 : 0;
                return (
                  <Link key={pkg.id} href={`/client/packages/${pkg.id}`}
                    className="shrink-0 w-52 bg-card border border-card-border rounded-xl p-4 block hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold truncate">{pkg.nickname}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {pkg.status === "active" ? "Active" : "Setting up"}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-navy">{fmtCurrency(value)}</div>
                    <div className={`text-xs mt-1 ${ret >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {ret >= 0 ? "+" : ""}{fmtCurrency(ret)} ({retPct >= 0 ? "+" : ""}{retPct.toFixed(1)}%)
                    </div>
                    {pkg.monthlyAmount && <div className="text-xs text-muted-foreground mt-1">{fmtCurrency(parseFloat(pkg.monthlyAmount))}/month</div>}
                  </Link>
                );
              })}
              <Link href="/client/portfolio" className="shrink-0 w-40 bg-card border border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40">
                <Plus className="h-5 w-5" />
                <span className="text-xs">Add package</span>
              </Link>
            </div>
          </motion.div>
        )}

        {advisorPushed && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-primary">Your advisor ran a scenario for you</span>
              <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">New</span>
            </div>
            {advisorPushed.advisorNote && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{advisorPushed.advisorNote}</p>}
            <Link href="/client/scenarios">
              <Button size="sm" variant="outline">View scenario <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </Link>
          </motion.div>
        )}

        {transactions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Recent Activity</h3>
              <Link href="/client/transactions" className="text-xs text-primary">View all</Link>
            </div>
            <div className="space-y-2.5">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{TX_TYPE_LABELS[tx.transactionType] ?? tx.transactionType}</div>
                    <div className="text-xs text-muted-foreground">{tx.package?.nickname} · {tx.transactionDate}</div>
                  </div>
                  <div className={`text-sm font-semibold ${["withdrawal", "fee_charged"].includes(tx.transactionType) ? "text-red-500" : "text-emerald-600"}`}>
                    {["withdrawal", "fee_charged"].includes(tx.transactionType) ? "-" : "+"}{fmtCurrency(parseFloat(tx.amountUsd))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {[
              { label: "View portfolio", href: "/client/portfolio", icon: TrendingUp },
              { label: "Run a scenario", href: "/client/scenarios", icon: Play },
              { label: "Message advisor", href: "/client/messages", icon: MessageSquare },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.label} href={a.href}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 bg-card border border-card-border rounded-full text-sm font-medium hover:bg-primary/5 transition-colors">
                  <Icon className="h-4 w-4 text-primary" /> {a.label}
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
