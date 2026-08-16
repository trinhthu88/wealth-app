import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import CurrencyDisplay from "@/components/client/CurrencyDisplay";
import HoldingTypeBadge from "@/components/client/HoldingTypeBadge";
import PriceTag from "../shared/PriceTag";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  holding: ClientHolding;
  onEdit: () => void;
}

export default function HoldingCard({ holding: h, onEdit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const isGain = h.gainLoss >= 0;
  const showGain = h.holdingType !== "cash" || (parseFloat(h.interestRatePct ?? "0") > 0);

  const TICKER_TYPES = new Set(["stock_etf", "etf", "mutual_fund", "commodity", "bond"]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const sym = h.holdingType === "crypto" ? h.coinSymbol : h.ticker;
      if (!sym) return;
      const endpoint = h.holdingType === "crypto" ? `/prices/crypto/${sym}` : `/prices/stock/${encodeURIComponent(sym)}`;
      await apiFetch(endpoint);
      qc.invalidateQueries({ queryKey: ["client-holdings-raw"] });
    } finally { setRefreshing(false); }
  }

  async function handleDelete() {
    await apiFetch(`/client/holdings/${h.id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["client-holdings-raw"] });
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <HoldingTypeBadge type={h.holdingType} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#042C53] truncate">{h.label}</p>
            <p className="text-xs text-slate-400 truncate">
              {TICKER_TYPES.has(h.holdingType) && `${h.ticker ?? ""} · ${h.unitsHeld} units`}
              {h.holdingType === "crypto" && `${h.coinSymbol ?? ""} · ${h.unitsHeld} units`}
              {h.holdingType === "property" && (h.propertyAddress ?? "")}
              {h.holdingType === "cash" && h.bankName}
              {h.holdingType === "pension" && h.schemeName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-sm font-bold text-[#042C53]"><CurrencyDisplay amountUsd={h.currentValue} compact /></p>
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)} aria-label="More options" className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 min-w-[160px]">
                <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-[#042C53] hover:bg-slate-50">Edit</button>
                <button onClick={() => { navigate(`/client/messages?about=${encodeURIComponent(h.label)}`); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-[#042C53] hover:bg-slate-50">Ask advisor about this</button>
                <button onClick={() => { setConfirmDelete(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50">Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showGain && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Cost: <CurrencyDisplay amountUsd={h.costBasis} compact /></span>
          {h.holdingType !== "cash" && (
            <span className={cn("font-medium", isGain ? "text-emerald-600" : "text-red-500")}>
              {isGain ? "+" : ""}{h.gainLossPct.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {(TICKER_TYPES.has(h.holdingType) || h.holdingType === "crypto") && h.currentPriceUsd !== null && (
        <PriceTag
          priceUsd={h.currentPriceUsd}
          change1dPct={0}
          isStale={h.isPriceStale}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onEdit} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Edit
        </button>
      </div>

      {confirmDelete && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-600">Remove this holding? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">Cancel</button>
            <button onClick={handleDelete} className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600">Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}
