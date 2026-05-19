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
  super_admin: "bg-primary/15 text-primary",
  advisor: "bg-blue-100 text-blue-700",
  investment_client: "bg-purple-100 text-purple-700",
  free_user: "bg-muted text-muted-foreground",
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
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create user
          </Button>
        }
      />

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">Create New User</h2>
              <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Full name</label>
                <Input className="mt-1" placeholder="Full name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Email address *</label>
                <Input className="mt-1" type="email" placeholder="user@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Temporary password *</label>
                <Input className="mt-1" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Role</label>
                <select className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              {form.role === "investment_client" && (
                <>
                  <div>
                    <label className="text-xs font-medium">Assign advisor</label>
                    <select className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm" value={form.advisorId} onChange={e => setForm(f => ({ ...f, advisorId: e.target.value }))}>
                      <option value="">— No advisor yet —</option>
                      {advisors.map(a => <option key={a.id} value={a.id}>{a.fullName ?? a.email}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Risk profile</label>
                    <select className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm" value={form.riskProfile} onChange={e => setForm(f => ({ ...f, riskProfile: e.target.value }))}>
                      <option value="">— Not set —</option>
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setForm(defaultForm); }}>Cancel</Button>
              <Button className="flex-1" disabled={create.isPending || !form.email || !form.password}
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
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTER_ALL.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={cn("text-xs px-3 py-1.5 rounded-full font-medium border transition-colors",
                roleFilter === r ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted")}>
              {r === "all" ? `All (${users.length})` : `${r.replace(/_/g, " ")} (${users.filter(u => u.role === r).length})`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <Users className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">No users found</h3>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {(u.fullName ?? u.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{u.fullName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editId === u.id ? (
                      <div className="flex items-center gap-2">
                        <select value={editRole} onChange={e => setEditRole(e.target.value)} className="h-7 px-2 border border-input rounded text-xs bg-background">
                          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                        </select>
                        <Button size="sm" className="h-7 text-xs px-2" onClick={() => update.mutate({ id: u.id, role: editRole })} disabled={update.isPending}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground")}>
                        {u.role.replace(/_/g, " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {editId !== u.id && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditId(u.id); setEditRole(u.role); }}>
                          Edit role
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
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
