import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface User { id: string; email: string; fullName: string | null; role: string; createdAt: string; }

const ROLES = ["free_user", "investment_client", "advisor", "super_admin"];
const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary/15 text-primary",
  advisor: "bg-blue-100 text-blue-700",
  investment_client: "bg-purple-100 text-purple-700",
  free_user: "bg-muted text-muted-foreground",
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["admin-users"], queryFn: () => apiFetch<User[]>("/admin/users") });

  const update = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => apiFetch(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ role }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setEditId(null); toast.success("User role updated"); },
    onError: () => toast.error("Failed to update"),
  });

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.fullName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader title="User Management" subtitle={`${users.length} registered users`} />

      <div className="mb-4">
        <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
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
                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {editId !== u.id && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditId(u.id); setEditRole(u.role); }}>
                        Edit Role
                      </Button>
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
