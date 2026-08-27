import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ClientAppShell from "@/components/client/AppShell";
import BottomSheet from "@/components/client/BottomSheet";
import SolNarration from "@/components/client/SolNarration";
import { apiFetch } from "@/lib/api";
import { usePlan } from "@/hooks/usePlan";
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
  const { advisorName } = usePlan();

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

  const latestDoc = docs[0] ?? null;

  return (
    <ClientAppShell>
      <div className="max-w-[860px] mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em]">Documents</h1>
            <p className="text-sm text-ink-40 mt-0.5">Statements and paperwork.</p>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-green text-green text-sm font-medium hover:bg-green-tint transition-colors"
          >
            <Plus className="h-4 w-4" />
            Request a document
          </button>
        </div>

        {!isLoading && latestDoc && (
          <SolNarration
            line={`${latestDoc.title} is here, dated ${new Date(latestDoc.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}.`}
            detail="Statements are the record of what your plan actually did — opening value, contributions, returns and every charge. Worth skimming the charges line at least once a year."
            advisorFirstName={advisorName?.split(" ")[0] ?? null}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-hairline/60 rounded-[20px] animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-surface border border-hairline rounded-[24px] p-12 text-center flex flex-col items-center gap-4 shadow-[0_2px_14px_rgba(20,52,42,.06)]">
            <Sol size="lg" animate="float" showFace />
            <div>
              <h3 className="font-display font-semibold text-forest mb-1">No documents yet</h3>
              <p className="text-ink-40 text-sm">Documents shared by your advisor will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {docs.map(d => {
              const role = d.uploadedByRole ?? null;
              const showBadge = role === "client" || role === "system";

              return (
                <div key={d.id} className="bg-surface border border-hairline rounded-[20px] px-[17px] py-[15px] flex items-center gap-3.5 shadow-[0_2px_14px_rgba(20,52,42,.06)]">
                  <div className="h-10 w-10 rounded-[10px] bg-green-tint flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[14.5px] text-forest">{d.title}</p>
                      {showBadge && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-hairline text-ink-40">
                          {role === "client" ? "Added by you" : "Auto-generated"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-ink-40 capitalize">{d.category}</span>
                      <span className="flex items-center gap-1 text-xs text-ink-40">
                        <Calendar className="h-3 w-3" />
                        {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {d.fileName && <span className="text-xs text-ink-40">{d.fileName}</span>}
                      {d.fileSizeBytes != null && d.fileSizeBytes > 0 && (
                        <span className="text-xs text-ink-40">{formatBytes(d.fileSizeBytes)}</span>
                      )}
                    </div>
                  </div>
                  {d.fileUrl && isValidDocumentUrl(d.fileUrl) && (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${d.title} (opens in new tab)`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline text-ink-40 hover:text-green hover:border-green/30 transition-colors shrink-0"
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

      <BottomSheet
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a document"
      >
        <div className="space-y-5 pb-4">
          <p className="text-sm text-ink-40">
            Your request will be sent to your advisor as a message.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-forest">Document type</label>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setRequestType(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                    requestType === type
                      ? "border-green bg-green-tint text-green"
                      : "border-hairline text-ink-60 hover:border-green/30"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-forest">
              Notes <span className="text-ink-30 font-normal">(optional)</span>
            </label>
            <textarea
              value={requestNotes}
              onChange={e => setRequestNotes(e.target.value)}
              placeholder="Any specific details or date range needed…"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-hairline text-sm text-forest placeholder:text-ink-30 resize-none focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
            />
          </div>

          <button
            onClick={handleSendRequest}
            disabled={!requestType || sendingRequest}
            className="w-full py-3 rounded-xl bg-green text-white font-semibold text-sm hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendingRequest ? "Sending…" : "Send request →"}
          </button>
        </div>
      </BottomSheet>
    </ClientAppShell>
  );
}
