import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, Star, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Lead { id: string; email: string; firstName: string | null; source: string | null; status: string; quizResult: unknown; healthScore: number | null; notes: string | null; createdAt: string; convertedUserId: string | null; }

const STATUS_COLORS: Record<string, string> = {
  new: "bg-sun-tint text-amber-ink",
  contacted: "bg-surface border border-hairline text-ink-60",
  qualified: "bg-green-tint text-green",
  converted: "bg-forest text-paper",
  lost: "bg-clay-tint text-clay-ink",
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
            <DialogTrigger asChild>
              <Button className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700">
                <Plus className="h-4 w-4 mr-2" /> Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm bg-surface rounded-[28px] p-6 border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-[20px] font-semibold text-forest">Add Lead</DialogTitle>
                <DialogDescription className="sr-only">Add a prospective investment client to the lead pipeline.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Email</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="email" placeholder="john@example.com" value={form.email} onChange={f("email")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">First Name</label>
                    <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="John" value={form.firstName} onChange={f("firstName")} />
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Source</label>
                    <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="Website, Referral…" value={form.source} onChange={f("source")} />
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Status</label>
                  <select value={form.status} onChange={f("status")} className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Notes</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="Additional context…" value={form.notes} onChange={f("notes")} />
                </div>
                <Button className="w-full rounded-full h-11 bg-green text-surface hover:bg-green-300 mt-2" onClick={() => add.mutate(form)} disabled={!form.email || add.isPending}>
                  {add.isPending ? "Adding…" : "Add Lead"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn("px-4 py-2 rounded-full text-[13px] font-medium transition-colors capitalize border", filter === s ? "bg-forest text-paper border-forest" : "bg-surface border-hairline text-ink-60 hover:bg-paper")}>
            {s === "all" ? `All (${leads.length})` : `${s} (${leads.filter(l => l.status === s).length})`}
          </button>
        ))}
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-surface rounded-[26px] animate-pulse" />)}</div>
        : filtered.length === 0 ? (
          <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
            <Star className="h-14 w-14 text-ink-20 mx-auto mb-4" />
            <h3 className="font-display text-[20px] font-semibold text-forest mb-2">No leads</h3>
            <p className="text-[14px] text-ink-40">Leads from the public quiz and sign-ups will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(l => (
              <div key={l.id} className="bg-surface rounded-[26px] px-6 py-5 flex items-center justify-between gap-4 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-[16px] bg-sun-tint flex items-center justify-center text-[16px] font-semibold text-amber-ink shrink-0">
                    {(l.firstName ?? l.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-[16px] text-forest">{l.firstName ? `${l.firstName} — ` : ""}{l.email}</div>
                    <div className="flex items-center gap-3 mt-1">
                      {l.source && <span className="text-[13px] text-ink-60">{l.source}</span>}
                      {l.healthScore && <span className="text-[13px] text-green font-medium">Score: {l.healthScore}</span>}
                      <span className="flex items-center gap-1.5 text-[13px] text-ink-40 tabular-nums"><Calendar className="h-3.5 w-3.5" />{new Date(l.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium capitalize", STATUS_COLORS[l.status] ?? "bg-surface border border-hairline text-ink-60")}>{l.status}</span>
                  {l.convertedUserId ? (
                    <span className="text-[13px] text-ink-40 italic">Client account created</span>
                  ) : (
                    <select value={l.status} onChange={e => handleStatusChange(l, e.target.value)} className="h-9 px-3 border border-hairline bg-paper rounded-[12px] text-[13px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      <Dialog open={!!convertTarget} onOpenChange={(v) => { if (!v) { setConvertTarget(null); setConvertPassword(""); } }}>
        <DialogContent className="max-w-sm bg-surface rounded-[28px] p-6 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-[20px] font-semibold text-forest">Convert to client</DialogTitle>
            <DialogDescription className="sr-only">Create an investment client account from this lead.</DialogDescription>
          </DialogHeader>
          {convertTarget && (
            <div className="space-y-4 pt-2">
              <p className="text-[14px] text-ink-60 leading-relaxed">
                Creates a real investment client account for <strong className="text-forest">{convertTarget.firstName ? `${convertTarget.firstName} — ` : ""}{convertTarget.email}</strong>, linked back to this lead.
              </p>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Temporary password</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="password" placeholder="Set an initial password" value={convertPassword} onChange={e => setConvertPassword(e.target.value)} />
              </div>
              <Button
                className="w-full rounded-full h-11 bg-green text-surface hover:bg-green-300 mt-2"
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
