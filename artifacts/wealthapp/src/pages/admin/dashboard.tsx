import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { Users, Star, BookOpen, ArrowRight, TrendingUp, DollarSign, UserCheck, Briefcase } from "lucide-react";

interface User { id: string; email: string; fullName: string | null; role: string; createdAt: string; }
interface Lead { id: string; status: string; }
interface BlogPost { id: string; status: string; title: string; }
interface AdminClient { id: string; portfolioValue: number; packagesCount: number; activePackages: number; status: string | null; advisorId: string | null; advisorName: string | null; }

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function AdminDashboard() {
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["admin-users"], queryFn: () => apiFetch<User[]>("/admin/users") });
  const { data: leads = [] } = useQuery<Lead[]>({ queryKey: ["leads"], queryFn: () => apiFetch<Lead[]>("/leads") });
  const { data: posts = [] } = useQuery<BlogPost[]>({ queryKey: ["all-blog"], queryFn: () => apiFetch<BlogPost[]>("/blog") });
  const { data: adminClients = [] } = useQuery<AdminClient[]>({ queryKey: ["admin-clients"], queryFn: () => apiFetch<AdminClient[]>("/admin/clients") });

  const advisors = users.filter(u => u.role === "advisor" || u.role === "super_admin");
  const clients = users.filter(u => u.role === "investment_client");
  const freeUsers = users.filter(u => u.role === "free_user");

  const totalAUM = adminClients.reduce((s, c) => s + (c.portfolioValue ?? 0), 0);
  const totalActivePackages = adminClients.reduce((s, c) => s + (c.activePackages ?? 0), 0);
  const activeClients = adminClients.filter(c => c.status === "active");

  // Advisor workload
  const advisorLoad = advisors.map(a => ({
    ...a,
    clientCount: adminClients.filter(c => c.advisorId === a.id).length,
    aum: adminClients.filter(c => c.advisorId === a.id).reduce((s, c) => s + (c.portfolioValue ?? 0), 0),
  })).sort((a, b) => b.aum - a.aum);

  return (
    <AppShell>
      <PageHeader title="Admin Dashboard" subtitle="Platform overview and management." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total AUM" value={fmtUSD(totalAUM)} sub={`${activeClients.length} active clients`} icon={TrendingUp} color="teal" />
        <StatCard label="Active Packages" value={totalActivePackages} sub={`${clients.length} investment clients`} icon={Briefcase} color="navy" />
        <StatCard label="Total Users" value={users.length} sub={`${advisors.length} advisors`} icon={Users} color="amber" />
        <StatCard label="Leads" value={leads.length} sub={`${leads.filter(l => l.status === "new").length} new`} icon={Star} color="teal" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Advisor Workload */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Advisor Workload</h3>
            <Link href="/admin/clients">
              <Button variant="ghost" size="sm" className="text-primary">All clients <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
            </Link>
          </div>
          {advisorLoad.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No advisors found.</p>
          ) : (
            <div className="space-y-3">
              {advisorLoad.slice(0, 6).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                      {(a.fullName ?? a.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{a.fullName ?? a.email}</div>
                      <div className="text-xs text-muted-foreground">{a.clientCount} clients</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtUSD(a.aum)}</div>
                    <div className="text-xs text-muted-foreground">AUM</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Distribution */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Role Distribution</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Super Admins", count: users.filter(u => u.role === "super_admin").length, total: users.length, color: "bg-primary" },
              { label: "Advisors", count: advisors.filter(a => a.role === "advisor").length, total: users.length, color: "bg-blue-500" },
              { label: "Investment Clients", count: clients.length, total: users.length, color: "bg-purple-500" },
              { label: "Free Users", count: freeUsers.length, total: users.length, color: "bg-muted-foreground" },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{r.label}</span>
                  <span className="font-medium">{r.count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className={`h-1.5 rounded-full ${r.color}`} style={{ width: `${r.total > 0 ? (r.count / r.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent Users */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Recent signups</span>
              <Link href="/admin/users">
                <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-1">Manage</Button>
              </Link>
            </div>
            <div className="space-y-1.5">
              {users.slice(0, 4).map(u => (
                <div key={u.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{u.fullName ?? u.email}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${u.role === "advisor" ? "bg-blue-100 text-blue-700" : u.role === "investment_client" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"}`}>
                    {u.role.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/admin/clients" className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
          <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0"><UserCheck className="h-5 w-5 text-purple-600" /></div>
          <div><div className="font-semibold text-sm">All Clients</div><div className="text-xs text-muted-foreground">{clients.length} investment clients</div></div>
        </Link>
        <Link href="/admin/prices" className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0"><DollarSign className="h-5 w-5 text-green-600" /></div>
          <div><div className="font-semibold text-sm">Fund Prices</div><div className="text-xs text-muted-foreground">Manage prices</div></div>
        </Link>
        <Link href="/admin/blog" className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><BookOpen className="h-5 w-5 text-primary" /></div>
          <div><div className="font-semibold text-sm">Blog</div><div className="text-xs text-muted-foreground">{posts.length} articles</div></div>
        </Link>
        <Link href="/advisor/leads" className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Star className="h-5 w-5 text-amber-600" /></div>
          <div><div className="font-semibold text-sm">Leads</div><div className="text-xs text-muted-foreground">{leads.length} total</div></div>
        </Link>
      </div>
    </AppShell>
  );
}
