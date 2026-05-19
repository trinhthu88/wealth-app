import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { Users, ClipboardList, Star, ArrowRight, Calendar, TrendingUp, Briefcase } from "lucide-react";

interface Client {
  id: string;
  fullName: string | null;
  email: string;
  kycStatus: string | null;
  status: string | null;
  portfolioValue: number;
  packagesCount: number;
}
interface Task { id: string; title: string; priority: string; status: string; dueDate: string | null; }
interface Lead { id: string; email: string; firstName: string | null; status: string; createdAt: string; }

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function AdvisorDashboard() {
  const { profile } = useProfile();
  const firstName = profile?.fullName?.split(" ")[0] ?? "Advisor";

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["advisor-clients"], queryFn: () => apiFetch<Client[]>("/advisor/clients") });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => apiFetch<Task[]>("/tasks") });
  const { data: leads = [] } = useQuery<Lead[]>({ queryKey: ["leads"], queryFn: () => apiFetch<Lead[]>("/leads") });

  const pendingTasks = tasks.filter(t => t.status === "todo" || t.status === "in_progress");
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done");
  const newLeads = leads.filter(l => l.status === "new");
  const totalAUM = clients.reduce((s, c) => s + (c.portfolioValue ?? 0), 0);
  const activeClients = clients.filter(c => c.status === "active");
  const totalPackages = clients.reduce((s, c) => s + (c.packagesCount ?? 0), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <PageHeader title={`${greeting}, ${firstName}!`} subtitle="Here's your advisory practice overview." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total AUM" value={fmtUSD(totalAUM)} sub={`${activeClients.length} active clients`} icon={TrendingUp} color="teal" />
        <StatCard label="Clients" value={clients.length} sub={`${totalPackages} packages`} icon={Briefcase} color="navy" />
        <StatCard label="Pending Tasks" value={pendingTasks.length} sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "All current"} icon={ClipboardList} color={overdueTasks.length > 0 ? "red" : "navy"} />
        <StatCard label="New Leads" value={newLeads.length} sub="Awaiting contact" icon={Star} color="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Clients</h3>
            <Link href="/advisor/clients">
              <Button variant="ghost" size="sm" className="text-primary">All clients <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
            </Link>
          </div>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No clients assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {clients.slice(0, 5).map(c => (
                <Link key={c.id} href={`/advisor/clients/${c.id}`} className="flex items-center justify-between py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(c.fullName ?? c.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{c.fullName ?? c.email}</div>
                      <div className="text-xs text-muted-foreground">{c.portfolioValue > 0 ? fmtUSD(c.portfolioValue) : c.email}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : c.status === "prospect" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
                    {c.status ?? "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Upcoming Tasks</h3>
            <Link href="/advisor/tasks">
              <Button variant="ghost" size="sm" className="text-primary">All tasks <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
            </Link>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No pending tasks.</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.slice(0, 5).map(t => {
                const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                return (
                  <div key={t.id} className="flex items-start gap-3 py-2">
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${t.priority === "high" ? "bg-red-500" : t.priority === "medium" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.title}</div>
                      {t.dueDate && (
                        <div className={`flex items-center gap-1 text-xs mt-0.5 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                          <Calendar className="h-3 w-3" />{new Date(t.dueDate).toLocaleDateString()}
                          {isOverdue && " (overdue)"}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{t.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AUM Breakdown */}
      {clients.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold mb-4">Client AUM Overview</h3>
          <div className="space-y-2">
            {clients.filter(c => c.portfolioValue > 0).sort((a, b) => b.portfolioValue - a.portfolioValue).slice(0, 6).map(c => {
              const pct = totalAUM > 0 ? (c.portfolioValue / totalAUM) * 100 : 0;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm">{c.fullName ?? c.email}</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-2 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-sm font-medium w-24 text-right">{fmtUSD(c.portfolioValue)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {newLeads.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">New Leads ({newLeads.length})</h3>
            <Link href="/advisor/leads"><Button variant="ghost" size="sm">View all</Button></Link>
          </div>
          <div className="space-y-2">
            {newLeads.slice(0, 3).map(l => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{l.firstName ? `${l.firstName} —` : ""} {l.email}</span>
                <span className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
