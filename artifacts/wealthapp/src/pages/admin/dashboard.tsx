import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { Users, Star, BookOpen, ArrowRight } from "lucide-react";

interface User { id: string; email: string; fullName: string | null; role: string; createdAt: string; }
interface Lead { id: string; status: string; }
interface BlogPost { id: string; status: string; title: string; }

export default function AdminDashboard() {
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["admin-users"], queryFn: () => apiFetch<User[]>("/admin/users") });
  const { data: leads = [] } = useQuery<Lead[]>({ queryKey: ["leads"], queryFn: () => apiFetch<Lead[]>("/leads") });
  const { data: posts = [] } = useQuery<BlogPost[]>({ queryKey: ["all-blog"], queryFn: () => apiFetch<BlogPost[]>("/blog") });

  const advisors = users.filter(u => u.role === "advisor");
  const clients = users.filter(u => u.role === "investment_client");
  const freeUsers = users.filter(u => u.role === "free_user");

  return (
    <AppShell>
      <PageHeader title="Admin Dashboard" subtitle="Platform overview and management." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={users.length} sub={`${advisors.length} advisors`} icon={Users} color="teal" />
        <StatCard label="Investment Clients" value={clients.length} sub="Active clients" icon={Users} color="navy" />
        <StatCard label="Free Users" value={freeUsers.length} sub="Registered" icon={Users} color="amber" />
        <StatCard label="Leads" value={leads.length} sub={`${leads.filter(l => l.status === "new").length} new`} icon={Star} color="teal" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Users</h3>
            <Link href="/admin/users"><Button variant="ghost" size="sm" className="text-primary">Manage <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
          </div>
          <div className="space-y-2">
            {users.slice(0, 6).map(u => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {(u.fullName ?? u.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{u.fullName ?? u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "super_admin" ? "bg-primary/15 text-primary" : u.role === "advisor" ? "bg-blue-100 text-blue-700" : u.role === "investment_client" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"}`}>
                  {u.role.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Role Distribution</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: "Super Admins", count: users.filter(u => u.role === "super_admin").length, total: users.length, color: "bg-primary" },
              { label: "Advisors", count: advisors.length, total: users.length, color: "bg-blue-500" },
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
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/admin/blog">
          <a className="bg-card border border-card-border rounded-xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><BookOpen className="h-6 w-6 text-primary" /></div>
            <div><div className="font-semibold">Blog Management</div><div className="text-sm text-muted-foreground">{posts.length} published articles</div></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto" />
          </a>
        </Link>
        <Link href="/advisor/leads">
          <a className="bg-card border border-card-border rounded-xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
            <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center"><Star className="h-6 w-6 text-amber-600" /></div>
            <div><div className="font-semibold">Lead Pipeline</div><div className="text-sm text-muted-foreground">{leads.length} total leads</div></div>
            <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto" />
          </a>
        </Link>
      </div>
    </AppShell>
  );
}
