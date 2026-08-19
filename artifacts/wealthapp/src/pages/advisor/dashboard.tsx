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
      <PageHeader title={`${greeting}, ${firstName}.`} subtitle="Here's your advisory practice overview." eyebrow="Workspace" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total AUM" value={fmtUSD(totalAUM)} sub={`${activeClients.length} active clients`} icon={TrendingUp} color="teal" />
        <StatCard label="Clients" value={clients.length} sub={`${totalPackages} packages`} icon={Briefcase} color="navy" />
        <StatCard label="Pending Tasks" value={pendingTasks.length} sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "All current"} icon={ClipboardList} color={overdueTasks.length > 0 ? "red" : "navy"} />
        <StatCard label="New Leads" value={newLeads.length} sub="Awaiting contact" icon={Star} color="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-[20px] font-semibold text-forest">Recent Clients</h3>
            <Link href="/advisor/clients" className="text-[14px] font-medium text-green hover:text-forest transition-colors flex items-center">
              All clients <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          {clients.length === 0 ? (
            <p className="text-[14px] text-ink-40 py-6 text-center">No clients assigned yet.</p>
          ) : (
            <div className="space-y-1">
              {clients.slice(0, 5).map(c => (
                <Link key={c.id} href={`/advisor/clients/${c.id}`} className="flex items-center justify-between py-2.5 hover:bg-paper rounded-[16px] px-3 -mx-3 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-tint flex items-center justify-center text-[15px] font-semibold text-green shrink-0">
                      {(c.fullName ?? c.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-forest text-[15px]">{c.fullName ?? c.email}</div>
                      <div className="text-[13px] text-ink-40">{c.portfolioValue > 0 ? fmtUSD(c.portfolioValue) : c.email}</div>
                    </div>
                  </div>
                  <span className={`text-[13px] px-3 py-1 rounded-full font-medium ${c.status === "active" ? "bg-green-tint text-green" : c.status === "prospect" ? "bg-sun-tint text-amber-ink" : "bg-hairline text-ink-60"}`}>
                    {c.status ?? "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-[20px] font-semibold text-forest">Upcoming Tasks</h3>
            <Link href="/advisor/tasks" className="text-[14px] font-medium text-green hover:text-forest transition-colors flex items-center">
              All tasks <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="text-[14px] text-ink-40 py-6 text-center">No pending tasks.</p>
          ) : (
            <div className="space-y-1">
              {pendingTasks.slice(0, 5).map(t => {
                const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                return (
                  <div key={t.id} className="flex items-start gap-3 py-2.5 px-3 -mx-3">
                    <div className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${t.priority === "high" ? "bg-clay" : t.priority === "medium" ? "bg-sun" : "bg-ink-20"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-forest text-[15px]">{t.title}</div>
                      {t.dueDate && (
                        <div className={`flex items-center gap-1.5 text-[13px] mt-1 ${isOverdue ? "text-clay font-medium" : "text-ink-40"}`}>
                          <Calendar className="h-3.5 w-3.5" />{new Date(t.dueDate).toLocaleDateString()}
                          {isOverdue && " (overdue)"}
                        </div>
                      )}
                    </div>
                    <span className="text-[13px] text-ink-40 shrink-0 capitalize">{t.status.replace("_", " ")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AUM Breakdown */}
      {clients.length > 0 && (
        <div className="bg-surface rounded-[26px] p-6 mb-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <h3 className="font-display text-[20px] font-semibold text-forest mb-5">Client AUM Overview</h3>
          <div className="space-y-4">
            {clients.filter(c => c.portfolioValue > 0).sort((a, b) => b.portfolioValue - a.portfolioValue).slice(0, 6).map(c => {
              const pct = totalAUM > 0 ? (c.portfolioValue / totalAUM) * 100 : 0;
              return (
                <div key={c.id} className="flex items-center gap-4">
                  <div className="w-32 truncate text-[15px] font-medium text-forest">{c.fullName ?? c.email}</div>
                  <div className="flex-1 h-[6px] bg-track rounded-full overflow-hidden">
                    <div className="h-full bg-green rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[15px] font-semibold text-forest w-24 text-right tabular-nums">{fmtUSD(c.portfolioValue)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {newLeads.length > 0 && (
        <div className="bg-sun-tint border border-[#FBE5C5] rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-[20px] font-semibold text-amber-ink">New Leads ({newLeads.length})</h3>
            <Link href="/advisor/leads">
              <Button variant="ghost" size="sm" className="text-amber-ink hover:bg-sun/20">View all</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {newLeads.slice(0, 3).map(l => (
              <div key={l.id} className="flex items-center justify-between text-[15px]">
                <span className="font-medium text-amber-ink">{l.firstName ? `${l.firstName} —` : ""} {l.email}</span>
                <span className="text-[13px] text-amber-ink/70">{new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
