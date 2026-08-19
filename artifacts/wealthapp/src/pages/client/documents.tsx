import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ClientAppShell from "@/components/client/AppShell";
import BottomSheet from "@/components/client/BottomSheet";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { FileText, Download, Calendar, Plus } from "lucide-react";
import Sol from "@/components/Sol";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Doc {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  uploadedByRole?: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Fix 4: URL validation for any remaining inputs
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

const REQUEST_TYPES = [
  "Annual report",
  "Quarterly statement",
  "KYC form",
  "Investment summary",
  "Tax document",
  "Other",
];

export default function ClientDocuments() {
  const { profile } = useProfile();

  // Fix 1: "Request a document" replaces arbitrary "Add Document"
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState("Annual report");
  const [requestNotes, setRequestNotes] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);

  const { data: docs = [], isLoading } = useQuery<Doc[]>({
    queryKey: ["documents"],
    queryFn: () => apiFetch<Doc[]>("/documents"),
  });

  const { data: convs = [] } = useQuery<Array<{ id: string; clientId: string; advisorId: string }>>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch("/conversations"),
  });
  const advisorConv = convs[0];

  async function handleSendRequest() {
    if (!requestType) return;
    setSendingRequest(true);
    try {
      const body = requestNotes.trim()
        ? `Document request: ${requestType} — ${requestNotes.trim()}`
        : `Document request: ${requestType}`;
      if (advisorConv) {
        await apiFetch(`/conversations/${advisorConv.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: body }),
        });
      }
      toast.success("Document request sent to your advisor");
      setRequestOpen(false);
      setRequestNotes("");
      setRequestType("Annual report");
    } catch {
      toast.error("Failed to send request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  }

  return (
    <ClientAppShell>
      <div className="max-w-[860px] mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#042C53]">Documents</h1>
            <p className="text-sm text-slate-400 mt-0.5">Your financial documents and reports.</p>
          </div>
          {/* Fix 1: "Request a document" — no arbitrary URL input */}
          <button
            onClick={() => setRequestOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1D9E75] text-[#1D9E75] text-sm font-medium hover:bg-[#1D9E75]/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Request a document
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center flex flex-col items-center gap-4">
            <Sol size="lg" animate="float" showFace />
            <div>
              <h3 className="font-semibold mb-1 text-[#042C53]">No documents yet</h3>
              <p className="text-slate-500 text-sm">Documents shared by your advisor will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map(d => {
              // Fix 3: uploaded_by_role badge (column may not exist)
              const role = d.uploadedByRole ?? null;
              const showBadge = role === "client" || role === "system";

              return (
                <div key={d.id} className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-[#1D9E75]/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-[#1D9E75]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-[#042C53]">{d.title}</p>
                      {/* Fix 3: role badge */}
                      {showBadge && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {role === "client" ? "Added by you" : "Auto-generated"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-400 capitalize">{d.category}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="h-3 w-3" />
                        {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {d.fileName && <span className="text-xs text-slate-400">{d.fileName}</span>}
                      {d.fileSizeBytes != null && d.fileSizeBytes > 0 && (
                        <span className="text-xs text-slate-400">{formatBytes(d.fileSizeBytes)}</span>
                      )}
                    </div>
                  </div>
                  {/* Fix 2: sr-only new-tab hint + Fix 4: URL validation before rendering link */}
                  {d.fileUrl && isValidDocumentUrl(d.fileUrl) && (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${d.title} (opens in new tab)`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-slate-500 hover:text-[#1D9E75] hover:border-[#1D9E75]/30 transition-colors shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-xs font-medium">Download</span>
                      <span className="sr-only"> (opens in new tab)</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fix 1: ARIA-correct BottomSheet — no arbitrary URL input */}
      <BottomSheet
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a document"
      >
        <div className="space-y-5 pb-4">
          <p className="text-sm text-slate-500">
            Your request will be sent to your advisor as a message.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#042C53]">Document type</label>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setRequestType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                    requestType === type
                      ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
                      : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/30"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#042C53]">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={requestNotes}
              onChange={e => setRequestNotes(e.target.value)}
              placeholder="Any specific details or date range needed…"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
            />
          </div>

          <button
            onClick={handleSendRequest}
            disabled={!requestType || sendingRequest}
            className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendingRequest ? "Sending…" : "Send request →"}
          </button>
        </div>
      </BottomSheet>
    </ClientAppShell>
  );
}
