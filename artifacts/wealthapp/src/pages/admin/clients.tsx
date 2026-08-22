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

// Only active | paused | churned are ever set now — see the note in
// advisor/clients.tsx's STATUS_COLORS for why "prospect"/"pending" are gone.
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-tint text-green",
  paused: "bg-surface border border-hairline text-ink-60",
  churned: "bg-clay-tint text-clay-ink",
};

const KYC_COLORS: Record<string, string> = {
  not_started: "bg-surface border border-hairline text-ink-60",
  not_submitted: "bg-surface border border-hairline text-ink-60",
  submitted: "bg-sun-tint text-amber-ink",
  approved: "bg-green-tint text-green",
  rejected: "bg-clay-tint text-clay-ink",
};

const STATUS_FILTERS = ["all", "active", "paused", "churned"];

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
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-surface border border-hairline rounded-[26px] p-6 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[32px] font-semibold text-forest leading-none">{clients.length}</div>
          <div className="text-[13px] text-ink-40 mt-1.5">Total clients</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-6 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[32px] font-semibold text-green leading-none">{activeCount}</div>
          <div className="text-[13px] text-ink-40 mt-1.5">Active</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-6 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[32px] font-semibold text-amber-ink leading-none">{unassigned}</div>
          <div className="text-[13px] text-ink-40 mt-1.5">Unassigned</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input placeholder="Search by name, email, or advisor…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm h-11 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green" />
        <div className="flex gap-2 flex-wrap items-center">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("text-[13px] px-4 py-2 rounded-full font-medium transition-colors capitalize border",
                statusFilter === s ? "bg-forest text-paper border-forest" : "bg-surface border-hairline text-ink-60 hover:bg-paper")}>
              {s === "all" ? `All (${clients.length})` : `${s} (${clients.filter(c => c.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-surface rounded-[26px] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <UserCheck className="h-14 w-14 text-ink-20 mx-auto mb-4" />
          <h3 className="font-display text-[20px] font-semibold text-forest mb-2">No clients found</h3>
          <p className="text-[14px] text-ink-40">Create clients via User Management.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[26px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Client</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Advisor</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Status</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">KYC</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">Risk</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline text-right">Portfolio</th>
                <th className="px-5 py-4 border-b border-hairline" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-paper transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-[14px] bg-sun-tint flex items-center justify-center text-[15px] font-bold text-amber-ink shrink-0">
                        {(c.fullName ?? c.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-[15px] text-forest">{c.fullName ?? "—"}</div>
                        <div className="text-[13px] text-ink-40">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {reassignId === c.id ? (
                      <div className="flex items-center gap-2">
                        <select value={reassignAdvisorId} onChange={e => setReassignAdvisorId(e.target.value)}
                          className="h-8 px-3 border border-hairline rounded-[10px] text-[13px] bg-paper text-forest">
                          <option value="">— None —</option>
                          {advisors.map(a => <option key={a.id} value={a.id}>{a.fullName ?? a.email}</option>)}
                        </select>
                        <Button size="sm" className="h-8 text-[12px] px-3 rounded-[10px] bg-green text-surface hover:bg-green-300" disabled={reassignMut.isPending}
                          onClick={() => reassignMut.mutate({ userId: c.id, advisorId: reassignAdvisorId })}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-[12px] px-3 rounded-[10px] text-ink-60 hover:text-forest" onClick={() => setReassignId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-[14px] text-ink-60 hover:text-forest group/btn transition-colors"
                        onClick={() => { setReassignId(c.id); setReassignAdvisorId(c.advisorId ?? ""); }}>
                        <span>{c.advisorName ?? <span className="text-amber-ink font-medium">Unassigned</span>}</span>
                        <RefreshCw className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium capitalize", STATUS_COLORS[c.status ?? "active"] ?? "bg-surface border border-hairline text-ink-60")}>
                      {(c.status ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium", KYC_COLORS[c.kycStatus ?? "not_started"] ?? "bg-surface border border-hairline text-ink-60")}>
                      {(c.kycStatus ?? "not started").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[14px] text-ink-60 capitalize hidden md:table-cell">{c.riskProfile ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="font-semibold text-forest text-[15px] tabular-nums">{c.portfolioValue > 0 ? fmtUSD(c.portfolioValue) : "—"}</div>
                    <div className="text-[13px] text-ink-40">{c.packagesCount} pkg{c.packagesCount !== 1 ? "s" : ""}</div>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/advisor/clients/${c.id}`} className="text-[14px] font-medium text-green hover:text-forest flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ArrowRight className="h-4 w-4" />
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
