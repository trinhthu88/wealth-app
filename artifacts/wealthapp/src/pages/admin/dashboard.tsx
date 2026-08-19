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
      <PageHeader title="Admin Dashboard" subtitle="Platform overview and management." eyebrow="Administration" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total AUM" value={fmtUSD(totalAUM)} sub={`${activeClients.length} active clients`} icon={TrendingUp} color="teal" />
        <StatCard label="Active Packages" value={totalActivePackages} sub={`${clients.length} investment clients`} icon={Briefcase} color="navy" />
        <StatCard label="Total Users" value={users.length} sub={`${advisors.length} advisors`} icon={Users} color="amber" />
        <StatCard label="Leads" value={leads.length} sub={`${leads.filter(l => l.status === "new").length} new`} icon={Star} color="teal" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Advisor Workload */}
        <div className="bg-surface rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-[20px] font-semibold text-forest">Advisor Workload</h3>
            <Link href="/admin/clients" className="text-[14px] font-medium text-green hover:text-forest transition-colors flex items-center">
              All clients <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
          {advisorLoad.length === 0 ? (
            <p className="text-[14px] text-ink-40 py-4 text-center">No advisors found.</p>
          ) : (
            <div className="space-y-1">
              {advisorLoad.slice(0, 6).map(a => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 -mx-3 rounded-[16px] hover:bg-paper transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[14px] bg-sun-tint flex items-center justify-center text-[15px] font-bold text-amber-ink shrink-0">
                      {(a.fullName ?? a.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-forest text-[15px]">{a.fullName ?? a.email}</div>
                      <div className="text-[13px] text-ink-40">{a.clientCount} clients</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-forest tabular-nums text-[15px]">{fmtUSD(a.aum)}</div>
                    <div className="text-[13px] text-ink-40">AUM</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Distribution */}
        <div className="bg-surface rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)] flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-[20px] font-semibold text-forest">Role Distribution</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: "Super Admins", count: users.filter(u => u.role === "super_admin").length, total: users.length, color: "bg-forest" },
              { label: "Advisors", count: advisors.filter(a => a.role === "advisor").length, total: users.length, color: "bg-green" },
              { label: "Investment Clients", count: clients.length, total: users.length, color: "bg-sun-deep" },
              { label: "Free Users", count: freeUsers.length, total: users.length, color: "bg-ink-30" },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-[14px] mb-1.5">
                  <span className="text-ink-60">{r.label}</span>
                  <span className="font-medium text-forest tabular-nums">{r.count}</span>
                </div>
                <div className="h-2 bg-track rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.total > 0 ? (r.count / r.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent Users */}
          <div className="mt-auto pt-6">
            <div className="flex items-center justify-between mb-3 border-t border-hairline pt-4">
              <span className="tala-eyebrow text-ink-40">Recent signups</span>
              <Link href="/admin/users" className="text-[13px] font-medium text-green hover:text-forest transition-colors">
                Manage
              </Link>
            </div>
            <div className="space-y-2">
              {users.slice(0, 4).map(u => (
                <div key={u.id} className="flex items-center justify-between text-[14px]">
                  <span className="text-ink-60 truncate">{u.fullName ?? u.email}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium capitalize ${u.role === "advisor" ? "bg-green-tint text-green" : u.role === "investment_client" ? "bg-sun-tint text-amber-ink" : "bg-hairline text-ink-60"}`}>
                    {u.role.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link href="/admin/clients" className="bg-surface rounded-[20px] p-5 flex flex-col gap-3 shadow-[0_2px_14px_rgba(20,52,42,0.06)] hover:shadow-[0_4px_20px_rgba(20,52,42,0.08)] transition-shadow">
          <div className="h-10 w-10 rounded-[14px] bg-sun-tint flex items-center justify-center shrink-0"><UserCheck className="h-5 w-5 text-amber-ink" /></div>
          <div><div className="font-semibold text-forest text-[15px]">All Clients</div><div className="text-[13px] text-ink-40">{clients.length} investment clients</div></div>
        </Link>
        <Link href="/admin/prices" className="bg-surface rounded-[20px] p-5 flex flex-col gap-3 shadow-[0_2px_14px_rgba(20,52,42,0.06)] hover:shadow-[0_4px_20px_rgba(20,52,42,0.08)] transition-shadow">
          <div className="h-10 w-10 rounded-[14px] bg-green-tint flex items-center justify-center shrink-0"><DollarSign className="h-5 w-5 text-green" /></div>
          <div><div className="font-semibold text-forest text-[15px]">Fund Prices</div><div className="text-[13px] text-ink-40">Manage prices</div></div>
        </Link>
        <Link href="/admin/benchmarks" className="bg-surface rounded-[20px] p-5 flex flex-col gap-3 shadow-[0_2px_14px_rgba(20,52,42,0.06)] hover:shadow-[0_4px_20px_rgba(20,52,42,0.08)] transition-shadow">
          <div className="h-10 w-10 rounded-[14px] bg-paper border border-hairline flex items-center justify-center shrink-0"><TrendingUp className="h-5 w-5 text-forest" /></div>
          <div><div className="font-semibold text-forest text-[15px]">Benchmarks</div><div className="text-[13px] text-ink-40">Expected returns</div></div>
        </Link>
        <Link href="/admin/blog" className="bg-surface rounded-[20px] p-5 flex flex-col gap-3 shadow-[0_2px_14px_rgba(20,52,42,0.06)] hover:shadow-[0_4px_20px_rgba(20,52,42,0.08)] transition-shadow">
          <div className="h-10 w-10 rounded-[14px] bg-paper border border-hairline flex items-center justify-center shrink-0"><BookOpen className="h-5 w-5 text-forest" /></div>
          <div><div className="font-semibold text-forest text-[15px]">Blog</div><div className="text-[13px] text-ink-40">{posts.length} articles</div></div>
        </Link>
        <Link href="/advisor/leads" className="bg-surface rounded-[20px] p-5 flex flex-col gap-3 shadow-[0_2px_14px_rgba(20,52,42,0.06)] hover:shadow-[0_4px_20px_rgba(20,52,42,0.08)] transition-shadow">
          <div className="h-10 w-10 rounded-[14px] bg-clay-tint flex items-center justify-center shrink-0"><Star className="h-5 w-5 text-clay-ink" /></div>
          <div><div className="font-semibold text-forest text-[15px]">Leads</div><div className="text-[13px] text-ink-40">{leads.length} total</div></div>
        </Link>
      </div>
    </AppShell>
  );
}
