import { useState } from "react";
import type { SyncedAsset, ManualAsset } from "@/hooks/useNetWorthItems";

const ASSET_CATEGORIES: Record<string, { label: string; color: string }> = {
  investment:  { label: "Investments",   color: "#042C53" },
  property:    { label: "Property",      color: "#3B82F6" },
  cash:        { label: "Cash & savings",color: "#0EA5E9" },
  pension:     { label: "Pension",       color: "#8B5CF6" },
  business:    { label: "Business",      color: "#F59E0B" },
  other_asset: { label: "Other assets",  color: "#94A3B8" },
  // Legacy free-tier categories
  savings:     { label: "Savings",       color: "#0EA5E9" },
  real_estate: { label: "Real estate",   color: "#3B82F6" },
};

const LIABILITY_CATEGORIES: Record<string, { label: string; color: string }> = {
  mortgage:         { label: "Mortgage",      color: "#DC2626" },
  personal_loan:    { label: "Personal loan", color: "#EF4444" },
  credit_card:      { label: "Credit card",   color: "#F87171" },
  business_debt:    { label: "Business debt", color: "#B91C1C" },
  other_liability:  { label: "Other",         color: "#FECACA" },
  // Legacy
  car_loan:         { label: "Car loan",      color: "#EF4444" },
  student_loan:     { label: "Student loan",  color: "#F87171" },
  other:            { label: "Other debt",    color: "#FECACA" },
};

function fmtUsd(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

interface Props {
  syncedAssets: SyncedAsset[];
  manualAssets: ManualAsset[];
  totalAssets: number;
  totalLiabilities: number;
  liabilityByCategory: Record<string, number>;
}

export default function NetWorthSummaryBar({
  syncedAssets, manualAssets, totalAssets, totalLiabilities, liabilityByCategory,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Build asset segment totals
  const assetByCategory: Record<string, number> = {};
  for (const a of syncedAssets) {
    assetByCategory[a.category] = (assetByCategory[a.category] ?? 0) + a.valueUsd;
  }
  for (const a of manualAssets) {
    const cat = a.category || "other_asset";
    assetByCategory[cat] = (assetByCategory[cat] ?? 0) + a.valueUsd;
  }

  const assetSegments = Object.entries(assetByCategory)
    .filter(([, v]) => v > 0)
    .map(([cat, v]) => ({
      cat,
      value: v,
      label: ASSET_CATEGORIES[cat]?.label ?? cat,
      color: ASSET_CATEGORIES[cat]?.color ?? "#94A3B8",
      pct: totalAssets > 0 ? (v / totalAssets) * 100 : 0,
    }));

  const liabSegments = Object.entries(liabilityByCategory)
    .filter(([, v]) => v > 0)
    .map(([cat, v]) => ({
      cat,
      value: v,
      label: LIABILITY_CATEGORIES[cat]?.label ?? cat,
      color: LIABILITY_CATEGORIES[cat]?.color ?? "#EF4444",
      pct: totalLiabilities > 0 ? (v / totalLiabilities) * 100 : 0,
    }));

  if (assetSegments.length === 0 && liabSegments.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-sm text-slate-400 text-center">
        Add your assets and liabilities to see your breakdown.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-4">
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Breakdown</p>

      {/* Asset bar */}
      {assetSegments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Assets</p>
          <div className="flex rounded-lg overflow-hidden h-3">
            {assetSegments.map(seg => (
              <div
                key={seg.cat}
                style={{ width: `${seg.pct}%`, background: seg.color }}
                className="transition-all cursor-default"
                onMouseEnter={() => setHovered(seg.cat)}
                onMouseLeave={() => setHovered(null)}
                title={`${seg.label}: ${fmtUsd(seg.value)} (${seg.pct.toFixed(1)}%)`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {assetSegments.map(seg => (
              <div
                key={seg.cat}
                className="flex items-center gap-1.5 text-xs"
                onMouseEnter={() => setHovered(seg.cat)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className={hovered === seg.cat ? "font-semibold text-[#042C53]" : "text-slate-500"}>
                  {seg.label}
                </span>
                <span className="font-medium text-[#042C53]">{fmtUsd(seg.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liability bar */}
      {liabSegments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Liabilities</p>
          <div className="flex rounded-lg overflow-hidden h-1.5">
            {liabSegments.map(seg => (
              <div
                key={seg.cat}
                style={{ width: `${seg.pct}%`, background: seg.color }}
                className="transition-all cursor-default"
                title={`${seg.label}: ${fmtUsd(seg.value)}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {liabSegments.map(seg => (
              <div key={seg.cat} className="flex items-center gap-1.5 text-xs">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className="text-slate-500">{seg.label}</span>
                <span className="font-medium text-red-500">{fmtUsd(seg.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
