import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Lead {
  id: string;
  email: string;
  firstName: string | null;
  source: string | null;
  status: string;
  assignedAdvisorId: string | null;
  userId: string | null;
  convertedUserId: string | null;
  createdAt: string;
}

interface Advisor { id: string; email: string; fullName: string | null; }

// unassigned (default) → active (assigned) → cold | churned | client — see
// leadsTable's schema comment (lib/db/src/schema/leads.ts) for the full model.
const STATUS_COLORS: Record<string, string> = {
  unassigned: "bg-sun-tint text-amber-ink",
  active: "bg-green-tint text-green",
  cold: "bg-surface border border-hairline text-ink-60",
  churned: "bg-clay-tint text-clay-ink",
  client: "bg-forest text-paper",
};

const STATUS_FILTERS = ["all", "unassigned", "active", "cold", "churned", "client"];

export default function AdminLeads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("unassigned");
  const [assignId, setAssignId] = useState<string | null>(null);
  const [assignAdvisorId, setAssignAdvisorId] = useState("");

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => apiFetch<Lead[]>("/leads"),
  });

  const { data: advisors = [] } = useQuery<Advisor[]>({
    queryKey: ["admin-advisors"],
    queryFn: () => apiFetch<Advisor[]>("/admin/advisors"),
  });

  const advisorLabel = (id: string | null) => {
    const advisor = advisors.find(a => a.id === id);
    return advisor ? (advisor.fullName ?? advisor.email) : null;
  };

  const assignMut = useMutation({
    mutationFn: ({ id, advisorId }: { id: string; advisorId: string }) =>
      apiFetch(`/leads/${id}/assign`, { method: "PUT", body: JSON.stringify({ advisorId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setAssignId(null);
      setAssignAdvisorId("");
      toast.success("Lead assigned");
    },
    onError: () => toast.error("Failed to assign lead"),
  });

  const filtered = leads.filter(l => {
    const matchesSearch = l.email.toLowerCase().includes(search.toLowerCase()) ||
      (l.firstName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const unassignedCount = leads.filter(l => l.status === "unassigned").length;

  return (
    <AppShell>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} total · ${unassignedCount} unassigned`}
        eyebrow="Administration"
      />

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm h-11 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green"
        />
        <div className="flex gap-2 flex-wrap items-center">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "text-[13px] px-4 py-2 rounded-full font-medium transition-colors capitalize border",
                statusFilter === s ? "bg-forest text-paper border-forest" : "bg-surface border-hairline text-ink-60 hover:bg-paper",
              )}
            >
              {s === "all" ? `All (${leads.length})` : `${s} (${leads.filter(l => l.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-surface rounded-[26px] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <Star className="h-14 w-14 text-ink-20 mx-auto mb-4" />
          <h3 className="font-display text-[20px] font-semibold text-forest mb-2">No leads found</h3>
          <p className="text-[14px] text-ink-40">Leads from interest CTAs and the public quiz will appear here.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[26px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Lead</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Source</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Status</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Advisor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-hairline last:border-0 hover:bg-paper transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[15px] text-forest">{l.firstName ?? "—"}</div>
                    <div className="text-[13px] text-ink-40">{l.email}</div>
                  </td>
                  <td className="px-5 py-3 text-[14px] text-ink-60">{l.source ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium capitalize inline-block", STATUS_COLORS[l.status] ?? "bg-surface border border-hairline text-ink-60")}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[14px] text-ink-60">
                    {assignId === l.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={assignAdvisorId}
                          onChange={e => setAssignAdvisorId(e.target.value)}
                          className="h-8 px-3 border border-hairline rounded-[10px] text-[13px] bg-paper text-forest"
                        >
                          <option value="">— Select advisor —</option>
                          {advisors.map(a => <option key={a.id} value={a.id}>{a.fullName ?? a.email}</option>)}
                        </select>
                        <Button
                          size="sm" className="h-8 text-[12px] px-3 rounded-[10px] bg-green text-surface hover:bg-green-300"
                          disabled={!assignAdvisorId || assignMut.isPending}
                          onClick={() => assignMut.mutate({ id: l.id, advisorId: assignAdvisorId })}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-[12px] px-3 rounded-[10px] text-ink-60 hover:text-forest" onClick={() => setAssignId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-[14px] hover:text-forest transition-colors"
                        onClick={() => { setAssignId(l.id); setAssignAdvisorId(l.assignedAdvisorId ?? ""); }}
                      >
                        {advisorLabel(l.assignedAdvisorId) ?? <span className="text-amber-ink font-medium">Unassigned</span>}
                      </button>
                    )}
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
