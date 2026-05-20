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
import { FileText, Plus, Download, Calendar } from "lucide-react";
import Sol from "@/components/Sol";
import { toast } from "sonner";

interface Doc { id: string; title: string; category: string; fileUrl: string; fileName: string | null; fileSizeBytes: number | null; createdAt: string; }

const CATEGORIES = ["plan", "report", "kyc", "statement", "tax", "contract", "other"];

export default function ClientDocuments() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "plan", fileUrl: "", fileName: "" });

  const { data: docs = [], isLoading } = useQuery<Doc[]>({ queryKey: ["documents"], queryFn: () => apiFetch<Doc[]>("/documents") });

  const add = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/documents", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["documents"] }); setOpen(false); toast.success("Document added"); },
    onError: () => toast.error("Failed to add document"),
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <AppShell>
      <PageHeader
        title="Documents"
        subtitle="Your financial documents and reports."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Document</Button></DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Title</Label><Input placeholder="Q1 Portfolio Report" value={form.title} onChange={f("title")} /></div>
                <div><Label>Category</Label>
                  <select value={form.category} onChange={f("category")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>File URL</Label><Input placeholder="https://..." value={form.fileUrl} onChange={f("fileUrl")} /></div>
                <div><Label>File Name</Label><Input placeholder="report.pdf" value={form.fileName} onChange={f("fileName")} /></div>
                <Button className="w-full" onClick={() => add.mutate(form)} disabled={!form.title || !form.fileUrl || add.isPending}>Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : docs.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-12 text-center flex flex-col items-center gap-4">
          <Sol size="lg" animate="float" showFace />
          <div>
            <h3 className="font-semibold mb-1">No documents yet</h3>
            <p className="text-muted-foreground text-sm">Documents shared by your advisor will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(d => (
            <div key={d.id} className="bg-card border border-card-border rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{d.title}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground capitalize">{d.category}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />{new Date(d.createdAt).toLocaleDateString()}
                  </span>
                  {d.fileName && <span className="text-xs text-muted-foreground">{d.fileName}</span>}
                </div>
              </div>
              <a href={d.fileUrl} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
              </a>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
