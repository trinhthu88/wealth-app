import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, Star, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Lead { id: string; email: string; firstName: string | null; source: string | null; status: string; quizResult: unknown; healthScore: number | null; notes: string | null; createdAt: string; convertedUserId: string | null; }

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  qualified: "bg-purple-100 text-purple-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-muted text-muted-foreground",
};

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"];

export default function AdvisorLeads() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ email: "", firstName: "", source: "", status: "new", notes: "" });
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [convertPassword, setConvertPassword] = useState("");

  const { data: leads = [], isLoading } = useQuery<Lead[]>({ queryKey: ["leads"], queryFn: () => apiFetch<Lead[]>("/leads") });

  const add = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/leads", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); setOpen(false); toast.success("Lead added"); },
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/leads/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const convert = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiFetch(`/leads/${id}/convert`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setConvertTarget(null);
      setConvertPassword("");
      toast.success("Lead converted to client");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to convert lead"),
  });

  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  function handleStatusChange(lead: Lead, newStatus: string) {
    if (newStatus === "converted") { setConvertTarget(lead); return; }
    update.mutate({ id: lead.id, status: newStatus });
  }

  return (
    <AppShell>
      <PageHeader
        title="Lead Pipeline"
        subtitle={`${leads.length} total leads`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Lead</Button></DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Email</Label><Input type="email" placeholder="john@example.com" value={form.email} onChange={f("email")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First Name</Label><Input placeholder="John" value={form.firstName} onChange={f("firstName")} /></div>
                  <div><Label>Source</Label><Input placeholder="Website, Referral…" value={form.source} onChange={f("source")} /></div>
                </div>
                <div><Label>Status</Label>
                  <select value={form.status} onChange={f("status")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label>Notes</Label><Input placeholder="Additional context…" value={form.notes} onChange={f("notes")} /></div>
                <Button className="w-full" onClick={() => add.mutate(form)} disabled={!form.email || add.isPending}>{add.isPending ? "Adding…" : "Add Lead"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize", filter === s ? "bg-primary text-white border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50")}>
            {s === "all" ? `All (${leads.length})` : `${s} (${leads.filter(l => l.status === s).length})`}
          </button>
        ))}
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
        : filtered.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl p-16 text-center">
            <Star className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No leads</h3>
            <p className="text-muted-foreground text-sm">Leads from the public quiz and sign-ups will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(l => (
              <div key={l.id} className="bg-card border border-card-border rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(l.firstName ?? l.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{l.firstName ? `${l.firstName} — ` : ""}{l.email}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {l.source && <span className="text-xs text-muted-foreground">{l.source}</span>}
                      {l.healthScore && <span className="text-xs text-primary font-medium">Score: {l.healthScore}</span>}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(l.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", STATUS_COLORS[l.status] ?? "bg-muted text-muted-foreground")}>{l.status}</span>
                  {l.convertedUserId ? (
                    <span className="text-xs text-muted-foreground">Client account created</span>
                  ) : (
                    <select value={l.status} onChange={e => handleStatusChange(l, e.target.value)} className="h-7 px-2 border border-input rounded text-xs bg-background">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={!!convertTarget} onOpenChange={(v) => { if (!v) { setConvertTarget(null); setConvertPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Convert to client</DialogTitle></DialogHeader>
          {convertTarget && (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Creates a real investment_client account for <strong>{convertTarget.firstName ? `${convertTarget.firstName} — ` : ""}{convertTarget.email}</strong>, linked back to this lead.
              </p>
              <div>
                <Label>Temporary password</Label>
                <Input type="password" placeholder="Set an initial password" value={convertPassword} onChange={e => setConvertPassword(e.target.value)} />
              </div>
              <Button
                className="w-full"
                disabled={!convertPassword || convert.isPending}
                onClick={() => convert.mutate({ id: convertTarget.id, password: convertPassword })}
              >
                {convert.isPending ? "Converting…" : "Create client account"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
