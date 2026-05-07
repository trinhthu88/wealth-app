import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { BarChart3, Target, FileText, MessageSquare, ArrowRight, TrendingUp, ClipboardList } from "lucide-react";

interface Holding { id: string; assetName: string; assetClass: string; currentValueUsd: string; weightPercent: string | null; }
interface Goal { id: string; title: string; status: string; targetAmount: string | null; currentAmount: string | null; }
interface Plan { id: string; title: string; status: string; nextReviewDate: string | null; }

export default function ClientDashboard() {
  const { profile } = useProfile();
  const firstName = profile?.fullName?.split(" ")[0] ?? "there";

  const { data: holdings = [] } = useQuery<Holding[]>({ queryKey: ["portfolio"], queryFn: () => apiFetch<Holding[]>("/portfolio") });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["goals"], queryFn: () => apiFetch<Goal[]>("/goals") });
  const { data: plans = [] } = useQuery<Plan[]>({ queryKey: ["plans"], queryFn: () => apiFetch<Plan[]>("/plans") });

  const portfolioValue = holdings.reduce((s, h) => s + parseFloat(h.currentValueUsd), 0);
  const currentPlan = plans[0];
  const onTrackGoals = goals.filter(g => g.status === "on_track" || g.status === "achieved").length;

  return (
    <AppShell>
      <PageHeader title={`Welcome back, ${firstName}!`} subtitle="Your investment portfolio at a glance." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Portfolio Value" value={`$${portfolioValue.toLocaleString()}`} sub={`${holdings.length} holdings`} icon={BarChart3} color="teal" />
        <StatCard label="Active Goals" value={goals.length} sub={`${onTrackGoals} on track`} icon={Target} color="navy" />
        <StatCard label="Financial Plan" value={currentPlan?.status ?? "No plan"} sub={currentPlan?.title ?? "Contact advisor"} icon={ClipboardList} color="teal" />
        <StatCard label="Documents" value="—" sub="View all files" icon={FileText} color="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Portfolio Holdings</h3>
            <Link href="/client/portfolio"><Button variant="ghost" size="sm" className="text-primary">View <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
          </div>
          {holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No holdings yet. Your advisor will add your portfolio.</p>
          ) : (
            <div className="space-y-2">
              {holdings.slice(0, 4).map(h => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{h.assetName}</div>
                    <div className="text-xs text-muted-foreground">{h.assetClass}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${parseFloat(h.currentValueUsd).toLocaleString()}</div>
                    {h.weightPercent && <div className="text-xs text-muted-foreground">{h.weightPercent}%</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">My Goals</h3>
            <Link href="/client/goals"><Button variant="ghost" size="sm" className="text-primary">View <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
          </div>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No goals set yet.</p>
          ) : (
            <div className="space-y-3">
              {goals.slice(0, 3).map(g => {
                const prog = g.targetAmount && g.currentAmount ? (parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100 : 0;
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{g.title}</span>
                      <span className="text-muted-foreground">{Math.round(prog)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full">
                      <div className="h-1.5 bg-primary rounded-full" style={{ width: `${Math.min(100, prog)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: "View Portfolio", href: "/client/portfolio", icon: BarChart3, sub: "Full allocation" },
          { label: "My Plan", href: "/client/plan", icon: ClipboardList, sub: currentPlan?.title ?? "See your roadmap" },
          { label: "Messages", href: "/client/messages", icon: MessageSquare, sub: "Chat with advisor" },
        ].map(a => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href}>
              <a className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon className="h-5 w-5 text-primary" /></div>
                <div><div className="font-medium text-sm">{a.label}</div><div className="text-xs text-muted-foreground">{a.sub}</div></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </a>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
