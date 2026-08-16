import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import ClientAppShell from "@/components/client/AppShell";
import BottomSheet from "@/components/client/BottomSheet";
import { apiFetch } from "@/lib/api";
import { fmtCurrency, ASSET_CLASS_COLORS } from "@/lib/portfolioCalculations";
import { ArrowRight, Plus, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
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

const TYPE_LABELS: Record<string, string> = {
  rsp: "RSP",
  lump_sum: "Lump Sum",
  combination: "Both",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending_setup: "bg-amber-100 text-amber-700",
  paused: "bg-slate-100 text-slate-600",
  closed: "bg-red-100 text-red-600",
};

export default function PackagesPage() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNotes, setRequestNotes] = useState("");

  const { data: packages = [], isLoading, isError } = useQuery<PackageSummary[]>({
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
        ? `Investment package request — ${notes.trim()}`
        : "I'd like to request a new investment package.";
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

  const totalValue = packages.reduce((s, p) => s + parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"), 0);
  const activeCount = packages.filter((p) => p.status === "active").length;

  return (
    <ClientAppShell>
      <div className="max-w-[860px] mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#042C53]">My Packages</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {activeCount} active · Total {fmtCurrency(totalValue)}
            </p>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1D9E75] text-[#1D9E75] text-sm font-medium hover:bg-[#1D9E75]/5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Request package
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Couldn't load packages</p>
            <p className="text-xs text-slate-400">Try refreshing the page.</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">No packages yet. Request one and your advisor will set it up.</p>
            <button
              onClick={() => setRequestOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#0F6E56] transition-colors"
            >
              Request your first package
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {packages.map((pkg) => {
              const value = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
              const invested = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
              const ret = value - invested;
              const retPct = invested > 0 ? (ret / invested) * 100 : 0;
              const isActive = pkg.status === "active";

              return (
                <Link key={pkg.id} href={`/client/packages/${pkg.id}`}>
                  <a className="block bg-white border border-[#E2E8F0] rounded-xl p-5 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base text-[#042C53]">{pkg.nickname}</h3>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            STATUS_COLORS[pkg.status] ?? "bg-slate-100 text-slate-600"
                          )}>
                            {pkg.status === "pending_setup" ? "Being set up" : pkg.status}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                          {TYPE_LABELS[pkg.type] ?? pkg.type}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                    </div>

                    {isActive ? (
                      <div>
                        <div className="text-2xl font-bold text-[#042C53] mb-1">{fmtCurrency(value)}</div>
                        <div className={cn(
                          "flex items-center gap-1 text-sm mb-3",
                          ret >= 0 ? "text-emerald-600" : "text-red-500"
                        )}>
                          {ret >= 0
                            ? <TrendingUp className="h-4 w-4" />
                            : <TrendingDown className="h-4 w-4" />}
                          {ret >= 0 ? "+" : ""}{fmtCurrency(Math.abs(ret))} ({ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%) since inception
                        </div>
                        {pkg.monthlyAmount && (
                          <div className="text-xs text-slate-400 mb-3">
                            {fmtCurrency(parseFloat(pkg.monthlyAmount))}/month
                          </div>
                        )}
                        {pkg.allocations.length > 0 && (
                          <div>
                            <div className="text-xs text-slate-400 mb-1.5">Fund allocation</div>
                            <div className="h-2 rounded-full overflow-hidden flex gap-px">
                              {pkg.allocations.map((a) => (
                                <div
                                  key={a.fundId}
                                  style={{
                                    width: `${a.weightPercent}%`,
                                    backgroundColor: ASSET_CLASS_COLORS[a.fund?.assetClass ?? "equity"] ?? "#94A3B8",
                                  }}
                                  className="h-full"
                                />
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                              {pkg.allocations.slice(0, 4).map((a) => (
                                <span key={a.fundId} className="text-xs text-slate-400 flex items-center gap-1">
                                  <span
                                    className="w-2 h-2 rounded-sm inline-block"
                                    style={{ background: ASSET_CLASS_COLORS[a.fund?.assetClass ?? "equity"] ?? "#94A3B8" }}
                                  />
                                  {a.fund?.name ?? "Fund"} {parseFloat(a.weightPercent).toFixed(0)}%
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400">
                        Being set up by your advisor
                        {pkg.startDate && <span> · Expected start: {pkg.startDate}</span>}
                      </div>
                    )}
                  </a>
                </Link>
              );
            })}

            {/* Request new package */}
            <button
              onClick={() => setRequestOpen(true)}
              className="w-full bg-white border-2 border-dashed border-[#E2E8F0] rounded-xl p-6 text-center hover:border-[#1D9E75]/40 transition-colors"
            >
              <Plus className="h-6 w-6 text-slate-400 mx-auto mb-2" />
              <div className="font-medium text-sm text-slate-600">Request a new package</div>
              <div className="text-xs text-slate-400 mt-1">Your advisor will set it up for you</div>
            </button>
          </div>
        )}
      </div>

      <BottomSheet
        isOpen={requestOpen}
        onClose={() => { setRequestOpen(false); setRequestNotes(""); }}
        title="Request a new package"
      >
        <div className="space-y-5 pb-4">
          <p className="text-sm text-slate-500">
            Your request will be sent to your advisor as a message.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#042C53]">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={requestNotes}
              onChange={e => setRequestNotes(e.target.value)}
              placeholder="e.g. I'd like a lump sum package focused on bonds…"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
            />
          </div>
          <button
            onClick={() => sendRequest.mutate(requestNotes)}
            disabled={sendRequest.isPending}
            className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendRequest.isPending ? "Sending…" : "Send request →"}
          </button>
        </div>
      </BottomSheet>
    </ClientAppShell>
  );
}
