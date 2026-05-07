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
import { Plus, BookOpen, Edit2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BlogPost { id: string; title: string; slug: string; excerpt: string | null; category: string | null; status: string; publishedAt: string | null; createdAt: string; }

const CATEGORIES = ["Investing", "Budgeting", "Expat Finance", "Retirement", "Real Estate", "Tax", "News", "Other"];

export default function AdminBlog() {
  const [open, setOpen] = useState(false);
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [form, setForm] = useState({ title: "", slug: "", excerpt: "", category: "Investing", contentMarkdown: "", status: "draft", coverImageUrl: "" });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["all-blog-admin"],
    queryFn: async () => {
      const published = await apiFetch<BlogPost[]>("/blog");
      return published;
    }
  });

  const create = useMutation({
    mutationFn: (d: typeof form) => apiFetch("/blog", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["all-blog-admin"] }); queryClient.invalidateQueries({ queryKey: ["blog"] }); setOpen(false); toast.success("Post created"); setForm({ title: "", slug: "", excerpt: "", category: "Investing", contentMarkdown: "", status: "draft", coverImageUrl: "" }); },
    onError: () => toast.error("Failed to create post"),
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: typeof form & { id: string }) => apiFetch(`/blog/${id}/admin`, { method: "PUT", body: JSON.stringify(d) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["all-blog-admin"] }); queryClient.invalidateQueries({ queryKey: ["blog"] }); setEditPost(null); toast.success("Post updated"); },
    onError: () => toast.error("Failed to update"),
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const openEdit = (p: BlogPost) => {
    setEditPost(p);
    setForm({ title: p.title, slug: p.slug, excerpt: p.excerpt ?? "", category: p.category ?? "Investing", contentMarkdown: "", status: p.status, coverImageUrl: "" });
  };

  const autoSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <AppShell>
      <PageHeader
        title="Blog Management"
        subtitle="Create and manage financial insights articles."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Post</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Article</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div><Label>Title</Label><Input placeholder="How to Build Wealth in SEA" value={form.title} onChange={e => { f("title")(e); setForm(p => ({ ...p, slug: autoSlug(e.target.value) })); }} /></div>
                <div><Label>Slug</Label><Input value={form.slug} onChange={f("slug")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label>
                    <select value={form.category} onChange={f("category")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><Label>Status</Label>
                    <select value={form.status} onChange={f("status")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                      {["draft", "published"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label>Excerpt</Label><Input placeholder="Short summary…" value={form.excerpt} onChange={f("excerpt")} /></div>
                <div><Label>Cover Image URL</Label><Input placeholder="https://…" value={form.coverImageUrl} onChange={f("coverImageUrl")} /></div>
                <div><Label>Content (Markdown)</Label>
                  <textarea value={form.contentMarkdown} onChange={f("contentMarkdown")} rows={8} placeholder="Write your article in Markdown…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none" />
                </div>
                <Button className="w-full" onClick={() => create.mutate(form)} disabled={!form.title || !form.slug || create.isPending}>{create.isPending ? "Creating…" : "Create Post"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {editPost && (
        <Dialog open={!!editPost} onOpenChange={v => !v && setEditPost(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Article</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div><Label>Title</Label><Input value={form.title} onChange={f("title")} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={f("slug")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <select value={form.category} onChange={f("category")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label>Status</Label>
                  <select value={form.status} onChange={f("status")} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
                    {["draft", "published", "archived"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div><Label>Excerpt</Label><Input value={form.excerpt} onChange={f("excerpt")} /></div>
              <div><Label>Content (Markdown)</Label>
                <textarea value={form.contentMarkdown} onChange={f("contentMarkdown")} rows={8} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none" />
              </div>
              <Button className="w-full" onClick={() => update.mutate({ ...form, id: editPost.id })} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save Changes"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <BookOpen className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">No posts yet</h3>
          <p className="text-muted-foreground text-sm mb-5">Create your first financial insights article.</p>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Post</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="bg-card border border-card-border rounded-xl px-5 py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">📝</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{p.title}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  {p.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", p.status === "published" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>{p.status}</span>
                  {p.publishedAt && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(p.publishedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
