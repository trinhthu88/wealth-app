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
  not_submitted: "bg-muted text-muted-foreground",
  not_started: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-700",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  prospect: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  active_prospect: "bg-teal-100 text-teal-700",
  pending: "bg-amber-100 text-amber-700",
  paused: "bg-slate-100 text-slate-600",
  churned: "bg-red-100 text-red-700",
};

const STATUS_FILTERS = ["all", "prospect", "active", "pending", "paused", "churned"];

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function AdvisorClients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", riskProfile: "", status: "prospect" });

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
      setForm({ email: "", password: "", fullName: "", riskProfile: "", status: "prospect" });
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
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add client
          </Button>
        }
      />

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">Add New Client</h2>
              <button onClick={() => setShowAddModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Full name</label>
                <Input className="mt-1" placeholder="Nguyen Van A" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Email address</label>
                <Input className="mt-1" type="email" placeholder="client@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Temporary password</label>
                <Input className="mt-1" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Risk profile</label>
                  <select className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm" value={form.riskProfile} onChange={e => setForm(f => ({ ...f, riskProfile: e.target.value }))}>
                    <option value="">— Select —</option>
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Initial status</label>
                  <select className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button className="flex-1" disabled={createMut.isPending || !form.email || !form.password}
                onClick={() => createMut.mutate({ email: form.email, password: form.password, fullName: form.fullName || undefined, role: "investment_client", riskProfile: form.riskProfile || undefined, status: form.status })}>
                {createMut.isPending ? "Creating…" : "Create client"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input placeholder="Search clients by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
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
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <Users className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{search ? "No matching clients" : "No clients yet"}</h3>
          <p className="text-muted-foreground text-sm">{search ? "Try a different search term." : "Add clients using the button above."}</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">KYC</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Risk</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Portfolio</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Packages</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {(c.fullName ?? c.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{c.fullName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLORS[c.status ?? "prospect"] ?? "bg-muted text-muted-foreground")}>
                      {(c.status ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", KYC_COLORS[c.kycStatus ?? "not_submitted"] ?? "bg-muted text-muted-foreground")}>
                      {(c.kycStatus ?? "not started").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize hidden md:table-cell">{c.riskProfile ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium hidden md:table-cell">{c.portfolioValue > 0 ? fmtUSD(c.portfolioValue) : "—"}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{c.packagesCount}</td>
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
