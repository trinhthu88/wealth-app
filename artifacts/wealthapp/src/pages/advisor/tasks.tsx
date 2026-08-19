import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Calendar, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task { id: string; title: string; description: string | null; priority: string; status: string; dueDate: string | null; clientId: string | null; }

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-surface border border-hairline text-ink-60",
  medium: "bg-sun-tint text-amber-ink",
  high: "bg-clay-tint text-clay-ink",
};

const STATUS_COLS = ["todo", "in_progress", "done"];

export default function AdvisorTasks() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", status: "todo", dueDate: "" });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => apiFetch<Task[]>("/tasks") });

  const add = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/tasks", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); toast.success("Task created"); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: Partial<Task> & { id: string }) => apiFetch(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted"); },
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <AppShell>
      <PageHeader
        title="Tasks"
        subtitle="Manage your advisory tasks and client follow-ups."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700">
                <Plus className="h-4 w-4 mr-2" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm bg-surface rounded-[28px] p-6 border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-[20px] font-semibold text-forest">Create Task</DialogTitle>
                <DialogDescription className="sr-only">Add a task to your advisory work queue.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Title</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="Follow up with client" value={form.title} onChange={f("title")} />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Description</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="Notes…" value={form.description} onChange={f("description")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Priority</label>
                    <select value={form.priority} onChange={f("priority")} className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green">
                      {["low", "medium", "high"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Due Date</label>
                    <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" type="date" value={form.dueDate} onChange={f("dueDate")} />
                  </div>
                </div>
                <Button className="w-full rounded-full h-11 bg-green text-surface hover:bg-green-300 mt-2" onClick={() => add.mutate(form)} disabled={!form.title || add.isPending}>
                  {add.isPending ? "Creating…" : "Create Task"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? <div className="animate-pulse space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-surface rounded-[26px]" />)}</div> : (
        <div className="grid md:grid-cols-3 gap-6">
          {STATUS_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col);
            return (
              <div key={col} className="bg-paper border border-hairline rounded-[28px] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-[15px] font-semibold text-forest capitalize">{col.replace("_", " ")}</span>
                  <span className="text-[13px] text-ink-60 bg-surface border border-hairline rounded-full px-2.5 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ClipboardList className="h-8 w-8 text-ink-20 mb-2" />
                      <p className="text-[13px] text-ink-40">No tasks</p>
                    </div>
                  )}
                  {colTasks.map(t => {
                    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done";
                    return (
                      <div key={t.id} className="bg-surface border border-hairline rounded-[22px] p-4 shadow-[0_2px_14px_rgba(20,52,42,0.03)] hover:shadow-[0_4px_20px_rgba(20,52,42,0.06)] transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-[15px] text-forest leading-snug">{t.title}</span>
                          <button onClick={() => del.mutate(t.id)} className="text-ink-30 hover:text-clay shrink-0 transition-colors bg-paper rounded-full p-1.5"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        {t.description && <p className="text-[13px] text-ink-40 mt-1.5 line-clamp-2 leading-relaxed">{t.description}</p>}
                        <div className="flex items-center justify-between mt-3">
                          <span className={cn("text-[12px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide", PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                          {t.dueDate && <span className={cn("flex items-center gap-1.5 text-[12px] font-medium tabular-nums", isOverdue ? "text-clay" : "text-ink-40")}><Calendar className="h-3.5 w-3.5" />{new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </div>
                        <div className="flex gap-1.5 mt-3 pt-3 border-t border-hairline">
                          {STATUS_COLS.filter(s => s !== t.status).map(s => (
                            <button key={s} onClick={() => update.mutate({ id: t.id, status: s, title: t.title, priority: t.priority })} className="flex-1 text-[12px] text-ink-60 hover:text-forest hover:bg-paper border border-hairline rounded-[12px] px-2 py-1.5 transition-colors font-medium">
                              → {s.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
