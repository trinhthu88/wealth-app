import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { UserCheck, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AdminClient {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  status: string | null;
  kycStatus: string | null;
  riskProfile: string | null;
  advisorId: string | null;
  advisorName: string | null;
  portfolioValue: number;
  packagesCount: number;
  activePackages: number;
}

interface Advisor { id: string; email: string; fullName: string | null; }

const STATUS_COLORS: Record<string, string> = {
  prospect: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  active_prospect: "bg-teal-100 text-teal-700",
  pending: "bg-amber-100 text-amber-700",
  paused: "bg-slate-100 text-slate-600",
  churned: "bg-red-100 text-red-700",
};

const KYC_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  not_submitted: "bg-muted text-muted-foreground",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_FILTERS = ["all", "prospect", "active", "pending", "paused", "churned"];

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function AdminClients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [reassignAdvisorId, setReassignAdvisorId] = useState("");

  const { data: clients = [], isLoading } = useQuery<AdminClient[]>({
    queryKey: ["admin-clients"],
    queryFn: () => apiFetch<AdminClient[]>("/admin/clients"),
  });

  const { data: advisors = [] } = useQuery<Advisor[]>({
    queryKey: ["admin-advisors"],
    queryFn: () => apiFetch<Advisor[]>("/admin/advisors"),
  });

  const reassignMut = useMutation({
    mutationFn: ({ userId, advisorId }: { userId: string; advisorId: string }) =>
      apiFetch(`/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ advisorId: advisorId || null }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setReassignId(null);
      toast.success("Advisor reassigned");
    },
    onError: () => toast.error("Failed to reassign advisor"),
  });

  const filtered = clients.filter(c => {
    const matchSearch = c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.advisorName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalAUM = clients.reduce((s, c) => s + (c.portfolioValue ?? 0), 0);
  const activeCount = clients.filter(c => c.status === "active").length;
  const unassigned = clients.filter(c => !c.advisorId).length;

  return (
    <AppShell>
      <PageHeader title="All Investment Clients" subtitle={`${clients.length} clients · ${fmtUSD(totalAUM)} total AUM`} />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold">{clients.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total clients</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Active</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{unassigned}</div>
          <div className="text-xs text-muted-foreground mt-1">Unassigned</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input placeholder="Search by name, email, or advisor…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("text-xs px-3 py-1.5 rounded-full font-medium border transition-colors capitalize",
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted")}>
              {s === "all" ? `All (${clients.length})` : `${s} (${clients.filter(c => c.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <UserCheck className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">No clients found</h3>
          <p className="text-muted-foreground text-sm">Create clients via User Management.</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Advisor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">KYC</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Risk</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Portfolio</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 shrink-0">
                        {(c.fullName ?? c.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{c.fullName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {reassignId === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={reassignAdvisorId} onChange={e => setReassignAdvisorId(e.target.value)}
                          className="h-7 px-2 border border-input rounded text-xs bg-background">
                          <option value="">— None —</option>
                          {advisors.map(a => <option key={a.id} value={a.id}>{a.fullName ?? a.email}</option>)}
                        </select>
                        <Button size="sm" className="h-7 text-xs px-2" disabled={reassignMut.isPending}
                          onClick={() => reassignMut.mutate({ userId: c.id, advisorId: reassignAdvisorId })}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-1" onClick={() => setReassignId(null)}>✕</Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground group"
                        onClick={() => { setReassignId(c.id); setReassignAdvisorId(c.advisorId ?? ""); }}>
                        <span>{c.advisorName ?? <span className="text-amber-600 font-medium">Unassigned</span>}</span>
                        <RefreshCw className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLORS[c.status ?? "prospect"] ?? "bg-muted text-muted-foreground")}>
                      {(c.status ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", KYC_COLORS[c.kycStatus ?? "not_started"] ?? "bg-muted text-muted-foreground")}>
                      {(c.kycStatus ?? "not started").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize hidden md:table-cell">{c.riskProfile ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">{c.portfolioValue > 0 ? fmtUSD(c.portfolioValue) : "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.packagesCount} pkg{c.packagesCount !== 1 ? "s" : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/advisor/clients/${c.id}`} className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium justify-end">
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
