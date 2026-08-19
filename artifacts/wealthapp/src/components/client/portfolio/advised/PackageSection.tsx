import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import BottomSheet from "@/components/client/BottomSheet";
import SourceBadge from "@/components/client/portfolio/shared/SourceBadge";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, ASSET_CLASS_COLORS } from "@/lib/portfolioCalculations";
import { ArrowRight, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

interface PackageSummary {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  lumpSumAmount: string | null;
  startDate: string | null;
  goalId: string | null;
  latestSnapshot: { totalValueUsd: string; totalInvestedUsd: string; totalReturnPercent: string } | null;
  allocations: Array<{ fundId: string; weightPercent: string; fund: { name: string; assetClass: string } | null }>;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending_setup: "bg-amber-100 text-amber-700",
  paused: "bg-slate-100 text-slate-600",
  closed: "bg-red-100 text-red-600",
};

export default function PackageSection() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNotes, setRequestNotes] = useState("");

  const { data: packages = [], isLoading } = useQuery<PackageSummary[]>({
    queryKey: ["my-packages"],
    queryFn: () => apiFetch("/packages"),
  });

  const { data: convs = [] } = useQuery<Array<{ id: string }>>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch("/conversations"),
  });

  const sendRequest = useMutation({
    mutationFn: (notes: string) => {
      const conv = convs[0];
      if (!conv) throw new Error("No advisor conversation found.");
      const body = notes.trim()
        ? `Investment account request — ${notes.trim()}`
        : "I'd like to request a new investment account.";
      return apiFetch(`/conversations/${conv.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: body }),
      });
    },
    onSuccess: () => {
      toast.success("Request sent to your advisor");
      setRequestOpen(false);
      setRequestNotes("");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: () => toast.error("Failed to send request. Please try again."),
  });

  if (!isLoading && packages.length === 0) {
    return (
      <button
        onClick={() => setRequestOpen(true)}
        className="w-full bg-white border-2 border-dashed border-[#E2E8F0] rounded-xl p-4 text-center hover:border-[#1D9E75]/40 transition-colors"
      >
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600">
          <Plus className="h-4 w-4" />
          Request new investment account
        </div>
        <div className="text-xs text-slate-400 mt-1">Your advisor will set it up for you</div>

        <BottomSheet
          isOpen={requestOpen}
          onClose={() => { setRequestOpen(false); setRequestNotes(""); }}
          title="Request a new investment account"
        >
          <RequestForm notes={requestNotes} onNotesChange={setRequestNotes} onSend={() => sendRequest.mutate(requestNotes)} pending={sendRequest.isPending} />
        </BottomSheet>
      </button>
    );
  }

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      {packages.map((pkg) => {
        const value = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
        const invested = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
        const ret = value - invested;
        const retPct = invested > 0 ? (ret / invested) * 100 : 0;
        const isActive = pkg.status === "active";

        return (
          <Link key={pkg.id} href={`/client/packages/${pkg.id}`} className="block bg-white border border-[#E2E8F0] rounded-xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm text-[#042C53]">{pkg.nickname}</h3>
                  <SourceBadge kind="advised" />
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[pkg.status] ?? "bg-slate-100 text-slate-600")}>
                    {pkg.status === "pending_setup" ? "Being set up" : pkg.status}
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
            </div>

            {isActive ? (
              <div>
                <div className="text-lg font-bold text-[#042C53] mb-1">{fmtCurrency(value)}</div>
                <div className={cn("flex items-center gap-1 text-xs mb-2", ret >= 0 ? "text-emerald-600" : "text-red-500")}>
                  {ret >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {ret >= 0 ? "+" : ""}{fmtCurrency(Math.abs(ret))} ({ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%) since inception
                </div>
                {pkg.allocations.length > 0 && (
                  <div className="h-1.5 rounded-full overflow-hidden flex gap-px">
                    {pkg.allocations.map((a) => (
                      <div
                        key={a.fundId}
                        style={{ width: `${a.weightPercent}%`, backgroundColor: ASSET_CLASS_COLORS[a.fund?.assetClass ?? "equity"] ?? "#94A3B8" }}
                        className="h-full"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                Being set up by your advisor
                {pkg.startDate && <span> · Expected start: {pkg.startDate}</span>}
              </div>
            )}
          </Link>
        );
      })}

      <button
        onClick={() => setRequestOpen(true)}
        className="w-full bg-white border-2 border-dashed border-[#E2E8F0] rounded-xl p-3 text-center hover:border-[#1D9E75]/40 transition-colors"
      >
        <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600">
          <Plus className="h-3.5 w-3.5" />
          Request new investment account
        </div>
      </button>

      <BottomSheet
        isOpen={requestOpen}
        onClose={() => { setRequestOpen(false); setRequestNotes(""); }}
        title="Request a new investment account"
      >
        <RequestForm notes={requestNotes} onNotesChange={setRequestNotes} onSend={() => sendRequest.mutate(requestNotes)} pending={sendRequest.isPending} />
      </BottomSheet>
    </div>
  );
}

function RequestForm({ notes, onNotesChange, onSend, pending }: {
  notes: string; onNotesChange: (v: string) => void; onSend: () => void; pending: boolean;
}) {
  return (
    <div className="space-y-5 pb-4">
      <p className="text-sm text-slate-500">Your request will be sent to your advisor as a message.</p>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#042C53]">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="e.g. I'd like a lump sum account focused on bonds…"
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
        />
      </div>
      <button
        onClick={onSend}
        disabled={pending}
        className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Sending…" : "Send request →"}
      </button>
    </div>
  );
}
