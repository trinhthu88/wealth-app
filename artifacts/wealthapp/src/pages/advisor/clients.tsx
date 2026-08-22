import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Users, ArrowRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Client {
  id: string;
  fullName: string | null;
  email: string;
  role: string;
  kycStatus: string | null;
  riskProfile: string | null;
  status: string | null;
  onboardingStep: number | null;
  createdAt: string;
  portfolioValue: number;
  packagesCount: number;
}

interface Advisor { id: string; email: string; fullName: string | null; }

const KYC_COLORS: Record<string, string> = {
  not_submitted: "bg-surface border border-hairline text-ink-60",
  not_started: "bg-surface border border-hairline text-ink-60",
  pending: "bg-sun-tint text-amber-ink",
  submitted: "bg-sun-tint text-amber-ink",
  approved: "bg-green-tint text-green",
  rejected: "bg-clay-tint text-clay-ink",
};

// Only active | paused | churned are ever set now — client_profiles.status
// represents an already-promoted client's account health (see lib/db/src/schema/clients.ts).
// "prospect"/"pending" belonged to the pre-promotion pipeline, which now lives
// entirely on the lead (see leads.ts / the advisor lead-detail page).
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-tint text-green",
  paused: "bg-surface border border-hairline text-ink-60",
  churned: "bg-clay-tint text-clay-ink",
};

const STATUS_FILTERS = ["all", "active", "paused", "churned"];

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function AdvisorClients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", riskProfile: "", status: "active" });

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["advisor-clients"],
    queryFn: () => apiFetch<Client[]>("/advisor/clients"),
  });

  const { data: advisors = [] } = useQuery<Advisor[]>({
    queryKey: ["admin-advisors"],
    queryFn: () => apiFetch<Advisor[]>("/admin/advisors"),
    enabled: showAddModal,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiFetch("/admin/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisor-clients"] });
      setShowAddModal(false);
      setForm({ email: "", password: "", fullName: "", riskProfile: "", status: "active" });
      toast.success("Client created successfully");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create client"),
  });

  const filtered = clients.filter(c => {
    const matchesSearch = c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.fullName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAUM = clients.reduce((s, c) => s + c.portfolioValue, 0);

  return (
    <AppShell>
      <PageHeader
        title="My Clients"
        subtitle={`${clients.length} clients · ${fmtUSD(totalAUM)} total AUM`}
        action={
          <Button onClick={() => setShowAddModal(true)} className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700">
            <Plus className="h-4 w-4 mr-2" /> Add client
          </Button>
        }
      />

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-[28px] p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-[20px] font-semibold text-forest">Add New Client</h2>
              <button onClick={() => setShowAddModal(false)} className="h-8 w-8 rounded-full hover:bg-paper flex items-center justify-center transition-colors">
                <X className="h-5 w-5 text-ink-40" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Full name</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="Nguyen Van A" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Email address</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="email" placeholder="client@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Temporary password</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Risk profile</label>
                  <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green" value={form.riskProfile} onChange={e => setForm(f => ({ ...f, riskProfile: e.target.value }))}>
                    <option value="">— Select —</option>
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Initial status</label>
                  <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="churned">Churned</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <Button variant="outline" className="flex-1 rounded-full h-11 border-hairline text-forest hover:bg-paper" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button className="flex-1 rounded-full h-11 bg-green text-surface hover:bg-green-300" disabled={createMut.isPending || !form.email || !form.password}
                onClick={() => createMut.mutate({ email: form.email, password: form.password, fullName: form.fullName || undefined, role: "investment_client", riskProfile: form.riskProfile || undefined, status: form.status })}>
                {createMut.isPending ? "Creating…" : "Create client"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input placeholder="Search clients by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm h-11 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green" />
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
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[72px] bg-surface rounded-[26px] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <Users className="h-14 w-14 text-ink-20 mx-auto mb-4" />
          <h3 className="font-display text-[20px] font-semibold text-forest mb-2">{search ? "No matching clients" : "No clients yet"}</h3>
          <p className="text-[14px] text-ink-40">{search ? "Try a different search term." : "Add clients using the button above."}</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Client</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Status</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">KYC</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">Risk</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell text-right">Portfolio</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden lg:table-cell text-right">Packages</th>
                <th className="px-5 py-4 border-b border-hairline" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-paper transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-tint flex items-center justify-center text-[15px] font-semibold text-green shrink-0">
                        {(c.fullName ?? c.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-[15px] text-forest">{c.fullName ?? "—"}</div>
                        <div className="text-[13px] text-ink-40">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium capitalize inline-block", STATUS_COLORS[c.status ?? "active"] ?? "bg-surface border border-hairline text-ink-60")}>
                      {(c.status ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium inline-block", KYC_COLORS[c.kycStatus ?? "not_submitted"] ?? "bg-surface border border-hairline text-ink-60")}>
                      {(c.kycStatus ?? "not started").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[14px] text-ink-60 capitalize hidden md:table-cell">{c.riskProfile ?? "—"}</td>
                  <td className="px-5 py-3 text-[15px] text-forest font-semibold text-right tabular-nums hidden md:table-cell">{c.portfolioValue > 0 ? fmtUSD(c.portfolioValue) : "—"}</td>
                  <td className="px-5 py-3 text-[14px] text-ink-60 text-right tabular-nums hidden lg:table-cell">{c.packagesCount}</td>
                  <td className="px-5 py-3 text-right">
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
