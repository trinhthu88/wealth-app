import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Users, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface User { id: string; email: string; fullName: string | null; role: string; createdAt: string; }
interface Advisor { id: string; email: string; fullName: string | null; }

const ROLES = ["free_user", "investment_client", "advisor", "super_admin"];
const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-forest text-paper",
  advisor: "bg-green-tint text-green",
  investment_client: "bg-sun-tint text-amber-ink",
  free_user: "bg-surface border border-hairline text-ink-60",
};

const ROLE_FILTER_ALL = ["all", ...ROLES];

interface CreateForm {
  email: string;
  password: string;
  fullName: string;
  role: string;
  advisorId: string;
  riskProfile: string;
}

const defaultForm: CreateForm = { email: "", password: "", fullName: "", role: "investment_client", advisorId: "", riskProfile: "" };

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultForm);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<User[]>("/admin/users"),
  });

  const { data: advisors = [] } = useQuery<Advisor[]>({
    queryKey: ["admin-advisors"],
    queryFn: () => apiFetch<Advisor[]>("/admin/advisors"),
    enabled: showCreate && form.role === "investment_client",
  });

  const update = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiFetch(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditId(null);
      toast.success("User role updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const create = useMutation({
    mutationFn: (data: any) => apiFetch("/admin/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false);
      setForm(defaultForm);
      toast.success("User created successfully");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create user"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted");
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const filtered = users.filter(u => {
    const matchSearch = u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.fullName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <AppShell>
      <PageHeader
        title="User Management"
        subtitle={`${users.length} registered users`}
        action={
          <Button className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create user
          </Button>
        }
      />

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-[28px] p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-[20px] font-semibold text-forest">Create New User</h2>
              <button onClick={() => setShowCreate(false)} className="h-8 w-8 rounded-full hover:bg-paper flex items-center justify-center transition-colors">
                <X className="h-5 w-5 text-ink-40" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Full name</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="Full name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Email address *</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="email" placeholder="user@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Temporary password *</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Role</label>
                <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              {form.role === "investment_client" && (
                <>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Assign advisor</label>
                    <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green" value={form.advisorId} onChange={e => setForm(f => ({ ...f, advisorId: e.target.value }))}>
                      <option value="">— No advisor yet —</option>
                      {advisors.map(a => <option key={a.id} value={a.id}>{a.fullName ?? a.email}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Risk profile</label>
                    <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green" value={form.riskProfile} onChange={e => setForm(f => ({ ...f, riskProfile: e.target.value }))}>
                      <option value="">— Not set —</option>
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <Button variant="outline" className="flex-1 rounded-full h-11 border-hairline text-forest hover:bg-paper" onClick={() => { setShowCreate(false); setForm(defaultForm); }}>Cancel</Button>
              <Button className="flex-1 rounded-full h-11 bg-green text-surface hover:bg-green-300" disabled={create.isPending || !form.email || !form.password}
                onClick={() => create.mutate({
                  email: form.email,
                  password: form.password,
                  fullName: form.fullName || undefined,
                  role: form.role,
                  advisorId: form.advisorId || undefined,
                  riskProfile: form.riskProfile || undefined,
                })}>
                {create.isPending ? "Creating…" : "Create user"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Role Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm h-11 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green" />
        <div className="flex gap-2 flex-wrap items-center">
          {ROLE_FILTER_ALL.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={cn("text-[13px] px-4 py-2 rounded-full font-medium transition-colors capitalize border",
                roleFilter === r ? "bg-forest text-paper border-forest" : "bg-surface border-hairline text-ink-60 hover:bg-paper")}>
              {r === "all" ? `All (${users.length})` : `${r.replace(/_/g, " ")} (${users.filter(u => u.role === r).length})`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-surface rounded-[26px] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <Users className="h-14 w-14 text-ink-20 mx-auto mb-4" />
          <h3 className="font-display text-[20px] font-semibold text-forest mb-2">No users found</h3>
        </div>
      ) : (
        <div className="bg-surface rounded-[26px] overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">User</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Role</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">Joined</th>
                <th className="px-5 py-4 border-b border-hairline" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-hairline last:border-0 hover:bg-paper transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-[14px] bg-green-tint flex items-center justify-center text-[15px] font-bold text-green shrink-0">
                        {(u.fullName ?? u.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-[15px] text-forest">{u.fullName ?? "—"}</div>
                        <div className="text-[13px] text-ink-40">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {editId === u.id ? (
                      <div className="flex items-center gap-2">
                        <select value={editRole} onChange={e => setEditRole(e.target.value)} className="h-8 px-3 border border-hairline rounded-[10px] text-[13px] bg-paper text-forest capitalize">
                          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                        </select>
                        <Button size="sm" className="h-8 text-[12px] px-3 rounded-[10px] bg-green text-surface hover:bg-green-300" onClick={() => update.mutate({ id: u.id, role: editRole })} disabled={update.isPending}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-[12px] px-3 rounded-[10px] text-ink-60 hover:text-forest" onClick={() => setEditId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium capitalize", ROLE_COLORS[u.role] ?? "bg-surface border border-hairline text-ink-60")}>
                        {u.role.replace(/_/g, " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[14px] text-ink-60 hidden md:table-cell tabular-nums">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {editId !== u.id && (
                      <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 text-[13px] rounded-[10px] text-green hover:text-forest" onClick={() => { setEditId(u.id); setEditRole(u.role); }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-[13px] rounded-[10px] text-clay hover:text-clay-ink hover:bg-clay-tint"
                          onClick={() => { if (confirm("Delete this user? This is irreversible.")) remove.mutate(u.id); }}>
                          Delete
                        </Button>
                      </div>
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
