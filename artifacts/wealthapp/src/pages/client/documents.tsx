import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ClientAppShell from "@/components/client/AppShell";
import Gated from "@/components/client/Gated";
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

function ClientDocumentsContent() {
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
        <div className="flex items-center justify-between gap-3">
          <div className="px-1">
            <h1 className="font-display text-[34px] leading-[1.05] text-forest">Documents</h1>
            <p className="text-[14px] text-ink-40 mt-1">Statements and paperwork.</p>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            className="shrink-0 flex items-center gap-1.5 h-11 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[14px] font-semibold hover:bg-surface transition-colors"
          >
            <Plus className="h-4 w-4" />
            Request a document
          </button>
        </div>

        {!isLoading && latestDoc && (
          <div className="bg-breeze rounded-[24px] p-4">
          <SolNarration
            className="mb-0"
            line={`${latestDoc.title} is here, dated ${new Date(latestDoc.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}.`}
            detail="Statements are the record of what your plan actually did — opening value, contributions, returns and every charge. Worth skimming the charges line at least once a year."
            advisorFirstName={advisorName?.split(" ")[0] ?? null}
          />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded-[24px] animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-surface rounded-[24px] p-10 text-center flex flex-col items-center gap-4">
            <Sol size="lg" animate="float" showFace />
            <div>
              <h3 className="text-[16px] font-semibold text-forest mb-1">No documents yet</h3>
              <p className="text-ink-40 text-[14px]">Documents shared by your advisor will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-[28px] p-1 flex flex-col">
            {docs.map((d, i) => {
              const role = d.uploadedByRole ?? null;
              const showBadge = role === "client" || role === "system";

              return (
                <div key={d.id} className="p-3 flex items-center gap-3 border-b border-hairline last:border-0">
                  <div className={cn("h-11 w-11 rounded-[14px] flex items-center justify-center shrink-0", i % 2 === 0 ? "bg-breeze" : "bg-field")}>
                    <FileText className="h-5 w-5 text-forest" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[15px] text-forest">{d.title}</p>
                      {showBadge && (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-paper text-ink-40">
                          {role === "client" ? "Added by you" : "Auto-generated"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[13px] text-ink-40 capitalize">{d.category}</span>
                      <span className="flex items-center gap-1 text-[13px] text-ink-40">
                        <Calendar className="h-3 w-3" />
                        {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {d.fileName && <span className="text-[13px] text-ink-40">{d.fileName}</span>}
                      {d.fileSizeBytes != null && d.fileSizeBytes > 0 && (
                        <span className="text-[13px] text-ink-40">{formatBytes(d.fileSizeBytes)}</span>
                      )}
                    </div>
                  </div>
                  {d.fileUrl && isValidDocumentUrl(d.fileUrl) && (
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${d.title} (opens in new tab)`}
                      className="flex items-center gap-1.5 min-h-11 px-3.5 rounded-full border-[1.5px] border-forest bg-transparent text-forest hover:bg-paper transition-colors shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-[12px] font-semibold">Download</span>
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
          <p className="text-[14px] text-ink-40">
            Your request will be sent to your advisor as a message.
          </p>

          <div className="space-y-2">
            <label className="text-[14px] font-semibold text-forest">Document type</label>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setRequestType(type)}
                  className={cn(
                    "min-h-10 px-3.5 rounded-full border-[1.5px] text-[13px] font-semibold transition-colors",
                    requestType === type
                      ? "border-forest bg-forest text-paper"
                      : "border-hairline-2 bg-transparent text-forest hover:bg-surface"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[14px] font-semibold text-forest">
              Notes <span className="text-ink-40 font-normal">(optional)</span>
            </label>
            <textarea
              value={requestNotes}
              onChange={e => setRequestNotes(e.target.value)}
              placeholder="Any specific details or date range needed…"
              rows={3}
              className="w-full px-4 py-2.5 rounded-[14px] border border-hairline bg-surface text-[14px] text-forest placeholder:text-ink-40 resize-none focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
            />
          </div>

          <button
            onClick={handleSendRequest}
            disabled={!requestType || sendingRequest}
            className="w-full h-12 rounded-full bg-forest text-paper font-semibold text-[15px] hover:bg-forest-700 disabled:bg-surface disabled:text-ink-40 disabled:cursor-not-allowed transition-colors"
          >
            {sendingRequest ? "Sending…" : "Send request →"}
          </button>
        </div>
      </BottomSheet>
    </ClientAppShell>
  );
}

export default function ClientDocuments() {
  return (
    <Gated capability="documents" page>
      <ClientDocumentsContent />
    </Gated>
  );
}
