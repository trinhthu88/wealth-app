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
import { Plus, Trash2, ClipboardList, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task { id: string; title: string; description: string | null; priority: string; status: string; dueDate: string | null; clientId: string | null; }

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
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
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Task</Button></DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Title</Label><Input placeholder="Follow up with client" value={form.title} onChange={f("title")} /></div>
                <div><Label>Description</Label><Input placeholder="Notes…" value={form.description} onChange={f("description")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority</Label>
                    <select value={form.priority} onChange={f("priority")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {["low", "medium", "high"].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={f("dueDate")} /></div>
                </div>
                <Button className="w-full" onClick={() => add.mutate(form)} disabled={!form.title || add.isPending}>{add.isPending ? "Creating…" : "Create Task"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? <div className="animate-pulse space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}</div> : (
        <div className="grid md:grid-cols-3 gap-4">
          {STATUS_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col);
            return (
              <div key={col} className="bg-muted/40 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-sm font-semibold capitalize">{col.replace("_", " ")}</span>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>}
                  {colTasks.map(t => {
                    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done";
                    return (
                      <div key={t.id} className="bg-card border border-card-border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm leading-snug">{t.title}</span>
                          <button onClick={() => del.mutate(t.id)} className="text-muted-foreground hover:text-red-500 shrink-0 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                          {t.dueDate && <span className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-red-500" : "text-muted-foreground")}><Calendar className="h-3 w-3" />{new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {STATUS_COLS.filter(s => s !== t.status).map(s => (
                            <button key={s} onClick={() => update.mutate({ id: t.id, status: s, title: t.title, priority: t.priority })} className="text-xs text-muted-foreground hover:text-primary border border-border rounded px-1.5 py-0.5 transition-colors">
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
