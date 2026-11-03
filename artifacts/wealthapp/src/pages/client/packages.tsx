import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import ClientAppShell from "@/components/client/AppShell";
import BottomSheet from "@/components/client/BottomSheet";
import { apiFetch } from "@/lib/api";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { ArrowUpRight, Plus, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
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

// Palette colours per asset class (Cobalt / Spring Field / Blue Breeze family).
const ASSET_CLASS_PALETTE: Record<string, string> = {
  equity: "var(--forest)",
  bond: "var(--field)",
  cash: "var(--breeze)",
  real_estate: "var(--forest-700)",
  commodity: "var(--mint-dim)",
  alternative: "var(--ink-30)",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-forest text-paper",
  pending_setup: "bg-sun text-forest",
  paused: "bg-paper text-forest",
  closed: "bg-paper text-ink-40",
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
      <div className="max-w-[860px] mx-auto space-y-4 pb-8">
        <div className="flex items-start justify-between gap-4 px-1">
          <div>
            <h1 className="font-display text-[34px] leading-[1.05] text-forest">My Packages</h1>
            <p className="text-[14px] text-ink-40 mt-1 tabular-nums">
              {activeCount} active · Total {fmtCurrency(totalValue)}
            </p>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            className="flex shrink-0 items-center gap-1.5 h-11 px-4 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[14px] font-semibold hover:bg-surface transition-colors"
          >
            <Plus className="h-4 w-4" />
            Request package
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-36 bg-surface rounded-[24px] animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="bg-surface rounded-[24px] p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
            <p className="text-[15px] font-semibold text-forest">Couldn't load packages</p>
            <p className="text-[13px] text-ink-40">Try refreshing the page.</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="bg-surface rounded-[24px] p-8 text-center space-y-4">
            <p className="text-[14px] text-ink-40">No packages yet. Request one and your advisor will set it up.</p>
            <button
              onClick={() => setRequestOpen(true)}
              className="h-12 px-5 rounded-full bg-forest text-paper text-[14px] font-semibold hover:bg-forest-700 transition-colors"
            >
              Request your first package
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => {
              const value = parseFloat(pkg.latestSnapshot?.totalValueUsd ?? "0");
              const invested = parseFloat(pkg.latestSnapshot?.totalInvestedUsd ?? "0");
              const ret = value - invested;
              const retPct = invested > 0 ? (ret / invested) * 100 : 0;
              const isActive = pkg.status === "active";

              return (
                <Link key={pkg.id} href={`/client/wealth/investments/packages/${pkg.id}`}>
                  <a className="block bg-surface rounded-[24px] p-5 hover:bg-green-tint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="font-semibold text-[16px] text-forest">{pkg.nickname}</h3>
                          <span className={cn(
                            "text-[12px] px-2.5 py-1 rounded-full font-semibold capitalize",
                            STATUS_COLORS[pkg.status] ?? "bg-paper text-forest"
                          )}>
                            {pkg.status === "pending_setup" ? "Being set up" : pkg.status}
                          </span>
                        </div>
                        <span className="text-[12px] text-forest font-medium bg-paper px-2.5 py-1 rounded-full">
                          {TYPE_LABELS[pkg.type] ?? pkg.type}
                        </span>
                      </div>
                      <span className="w-9 h-9 rounded-full bg-forest text-paper flex items-center justify-center shrink-0" aria-hidden="true">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </div>

                    {isActive ? (
                      <div>
                        <div className="font-display tabular-nums text-[32px] leading-none tracking-[-0.03em] text-forest mb-2">{fmtCurrency(value)}</div>
                        <div className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums text-forest mb-3",
                          ret >= 0 ? "bg-field" : "bg-sun"
                        )}>
                          {ret >= 0
                            ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                            : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
                          {ret >= 0 ? "+" : ""}{fmtCurrency(Math.abs(ret))} ({ret >= 0 ? "+" : ""}{retPct.toFixed(1)}%) since inception
                        </div>
                        {pkg.monthlyAmount && (
                          <div className="text-[13px] text-ink-40 mb-3 tabular-nums">
                            {fmtCurrency(parseFloat(pkg.monthlyAmount))}/month
                          </div>
                        )}
                        {pkg.allocations.length > 0 && (
                          <div>
                            <div className="tala-eyebrow text-ink-40 mb-2">Fund allocation</div>
                            <div className="h-2 rounded-full overflow-hidden flex gap-px bg-forest/15">
                              {pkg.allocations.map((a) => (
                                <div
                                  key={a.fundId}
                                  style={{
                                    width: `${a.weightPercent}%`,
                                    backgroundColor: ASSET_CLASS_PALETTE[a.fund?.assetClass ?? "equity"] ?? "var(--ink-20)",
                                  }}
                                  className="h-full"
                                />
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                              {pkg.allocations.slice(0, 4).map((a) => (
                                <span key={a.fundId} className="text-[12px] text-ink-40 flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ background: ASSET_CLASS_PALETTE[a.fund?.assetClass ?? "equity"] ?? "var(--ink-20)" }}
                                  />
                                  {a.fund?.name ?? "Fund"} {parseFloat(a.weightPercent).toFixed(0)}%
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[14px] text-ink-40">
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
              className="w-full flex items-center gap-3 bg-breeze rounded-[24px] p-4 text-left hover:bg-mint-dim transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              <span className="w-11 h-11 rounded-[14px] bg-forest text-paper flex items-center justify-center shrink-0" aria-hidden="true">
                <Plus className="h-5 w-5" />
              </span>
              <span className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] text-forest">Request a new package</div>
              <div className="text-[13px] text-forest mt-0.5">Your advisor will set it up for you</div>
              </span>
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
          <p className="text-[14px] text-ink-40">
            Your request will be sent to your advisor as a message.
          </p>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-forest">
              Notes <span className="text-ink-40 font-normal">(optional)</span>
            </label>
            <textarea
              value={requestNotes}
              onChange={e => setRequestNotes(e.target.value)}
              placeholder="e.g. I'd like a lump sum package focused on bonds…"
              rows={3}
              className="w-full px-4 py-3 rounded-[14px] border border-hairline bg-surface text-[14px] text-forest placeholder:text-ink-30 resize-none focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-forest"
            />
          </div>
          <button
            onClick={() => sendRequest.mutate(requestNotes)}
            disabled={sendRequest.isPending}
            className="w-full h-12 rounded-full bg-forest text-paper font-semibold text-[14px] hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendRequest.isPending ? "Sending…" : "Send request →"}
          </button>
        </div>
      </BottomSheet>
    </ClientAppShell>
  );
}
