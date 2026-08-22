import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DocumentItem {
  id: string; title: string; category: string; fileUrl: string;
  fileName: string | null; uploadedAt: string; isAdminUploaded: boolean;
}

// "kyc" documents live here now, alongside every other category — no separate
// verify/reject surface (see api-server/src/routes/kyc.ts). Category is just a
// tag to group/filter by, not a workflow state.
const DOCUMENT_CATEGORIES = ["kyc", "agreement", "statement", "other"];

// Mirrors pages/client/documents.tsx's isValidDocumentUrl — same reasoning: no
// arbitrary non-https / link-shortener URLs accepted as a document link.
function isValidDocumentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const blocked = ["bit.ly", "tinyurl.com", "t.co", "goo.gl"];
    if (blocked.some(d => parsed.hostname.includes(d))) return false;
    return true;
  } catch {
    return false;
  }
}

interface Props {
  // e.g. `/advisor/leads/${leadUserId}` or `/advisor/clients/${clientUserId}` —
  // this component hits `${basePath}/documents` for both list and upload.
  basePath: string;
  // Tabs in this app keep every TabsContent mounted, not just the active one —
  // pass `activeTab === "documents"` so this doesn't fetch until its own tab
  // is actually open (matches the same guard used for the Messages tab).
  enabled: boolean;
}

export default function DocumentsManager({ basePath, enabled }: Props) {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [docForm, setDocForm] = useState({ title: "", category: "kyc", fileUrl: "" });

  const { data: documents = [] } = useQuery<DocumentItem[]>({
    queryKey: ["advisor-documents", basePath],
    queryFn: () => apiFetch(`${basePath}/documents`),
    enabled,
  });

  const uploadDocMut = useMutation({
    mutationFn: (data: typeof docForm) => apiFetch(`${basePath}/documents`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advisor-documents", basePath] });
      setDocForm({ title: "", category: "kyc", fileUrl: "" });
      toast.success("Document uploaded");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to upload document"),
  });

  const filtered = categoryFilter === "all" ? documents : documents.filter(d => d.category === categoryFilter);

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)] space-y-4">
        <h3 className="font-display text-[18px] font-semibold text-forest">Upload a document</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2">
            <label className="text-[13px] font-medium text-ink-60 block">Title</label>
            <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={docForm.title} onChange={(e) => setDocForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Passport.pdf" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-60 block">Category</label>
            <select className="w-full h-11 border border-hairline bg-paper rounded-[12px] px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize" value={docForm.category} onChange={(e) => setDocForm(f => ({ ...f, category: e.target.value }))}>
              {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-60 block">File URL</label>
            <Input className="h-11 rounded-[12px] border-hairline bg-paper px-4 focus-visible:ring-green" value={docForm.fileUrl} onChange={(e) => setDocForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://…" />
          </div>
        </div>
        <Button
          className="rounded-full h-11 px-6 bg-green text-surface hover:bg-green-300"
          disabled={uploadDocMut.isPending || !docForm.title || !isValidDocumentUrl(docForm.fileUrl)}
          onClick={() => uploadDocMut.mutate(docForm)}
        >
          <Plus className="h-4 w-4 mr-2" /> {uploadDocMut.isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {documents.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {["all", ...DOCUMENT_CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={cn(
                "text-[13px] px-4 py-2 rounded-full font-medium transition-colors capitalize border",
                categoryFilter === c ? "bg-forest text-paper border-forest" : "bg-surface border-hairline text-ink-60 hover:bg-paper",
              )}
            >
              {c === "all" ? `All (${documents.length})` : `${c} (${documents.filter(d => d.category === c).length})`}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">
          {documents.length === 0 ? "No documents uploaded." : "No documents in this category."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(d => (
            <div key={d.id} className="bg-surface border border-hairline rounded-[20px] p-5 shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-[15px] text-forest">{d.title}</div>
                <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase bg-surface border border-hairline text-ink-60 capitalize">{d.category}</span>
              </div>
              <div className="text-[12px] text-ink-40 tabular-nums">Uploaded: {new Date(d.uploadedAt).toLocaleDateString()}{d.isAdminUploaded ? " · by advisor" : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
