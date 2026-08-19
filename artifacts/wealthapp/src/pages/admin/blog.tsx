import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Plus, BookOpen, Edit2, Calendar, X } from "lucide-react";
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
            <DialogTrigger asChild>
              <Button className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700">
                <Plus className="h-4 w-4 mr-2" /> New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface rounded-[28px] p-6 border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-[20px] font-semibold text-forest">Create Article</DialogTitle>
                <DialogDescription className="sr-only">Draft and publish a financial insights article.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Title</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="How to Build Wealth in SEA" value={form.title} onChange={e => { f("title")(e); setForm(p => ({ ...p, slug: autoSlug(e.target.value) })); }} />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Slug</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={form.slug} onChange={f("slug")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Category</label>
                    <select value={form.category} onChange={f("category")} className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green">
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Status</label>
                    <select value={form.status} onChange={f("status")} className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize">
                      {["draft", "published"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Excerpt</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="Short summary…" value={form.excerpt} onChange={f("excerpt")} />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Cover Image URL</label>
                  <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" placeholder="https://…" value={form.coverImageUrl} onChange={f("coverImageUrl")} />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Content (Markdown)</label>
                  <textarea value={form.contentMarkdown} onChange={f("contentMarkdown")} rows={8} placeholder="Write your article in Markdown…" className="w-full rounded-[12px] border border-hairline bg-paper px-4 py-3 text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-green resize-none" />
                </div>
                <Button className="w-full rounded-full h-11 bg-green text-surface hover:bg-green-300 mt-2" onClick={() => create.mutate(form)} disabled={!form.title || !form.slug || create.isPending}>
                  {create.isPending ? "Creating…" : "Create Post"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {editPost && (
        <Dialog open={!!editPost} onOpenChange={v => !v && setEditPost(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface rounded-[28px] p-6 border-none shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-display text-[20px] font-semibold text-forest">Edit Article</DialogTitle>
              <DialogDescription className="sr-only">Update this financial insights article.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Title</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={form.title} onChange={f("title")} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Slug</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={form.slug} onChange={f("slug")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Category</label>
                  <select value={form.category} onChange={f("category")} className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Status</label>
                  <select value={form.status} onChange={f("status")} className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize">
                    {["draft", "published", "archived"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Excerpt</label>
                <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={form.excerpt} onChange={f("excerpt")} />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Content (Markdown)</label>
                <textarea value={form.contentMarkdown} onChange={f("contentMarkdown")} rows={8} className="w-full rounded-[12px] border border-hairline bg-paper px-4 py-3 text-[14px] font-mono focus:outline-none focus:ring-2 focus:ring-green resize-none" />
              </div>
              <Button className="w-full rounded-full h-11 bg-green text-surface hover:bg-green-300 mt-2" onClick={() => update.mutate({ ...form, id: editPost.id })} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-surface rounded-[26px] animate-pulse" />)}</div>
      ) : posts.length === 0 ? (
        <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <BookOpen className="h-14 w-14 text-ink-20 mx-auto mb-4" />
          <h3 className="font-display text-[20px] font-semibold text-forest mb-2">No posts yet</h3>
          <p className="text-[14px] text-ink-40 mb-6">Create your first financial insights article.</p>
          <Button className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Post</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(p => (
            <div key={p.id} className="bg-surface rounded-[26px] px-6 py-5 flex items-center gap-5 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
              <div className="h-14 w-14 rounded-[16px] bg-paper border border-hairline flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6 text-forest" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[16px] text-forest">{p.title}</div>
                <div className="flex items-center gap-3 mt-1.5">
                  {p.category && <span className="text-[13px] text-ink-60">{p.category}</span>}
                  <span className={cn("text-[12px] px-2 py-0.5 rounded-[8px] font-medium tracking-wide uppercase", p.status === "published" ? "bg-green-tint text-green" : "bg-surface border border-hairline text-ink-60")}>{p.status}</span>
                  {p.publishedAt && <span className="flex items-center gap-1.5 text-[13px] text-ink-40 tabular-nums"><Calendar className="h-3.5 w-3.5" />{new Date(p.publishedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-10 w-10 rounded-full text-ink-40 hover:text-green hover:bg-green-tint" onClick={() => openEdit(p)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
