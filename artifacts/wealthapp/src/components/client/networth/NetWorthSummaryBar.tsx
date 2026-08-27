import { useState } from "react";
import type { SyncedAsset, ManualAsset } from "@/hooks/useNetWorthItems";

const ASSET_CATEGORIES: Record<string, { label: string; color: string }> = {
  investment:  { label: "Investments",   color: "var(--green)" },
  property:    { label: "Property",      color: "var(--forest)" },
  cash:        { label: "Cash & savings",color: "var(--mint)" },
  pension:     { label: "Pension",       color: "var(--violet)" },
  business:    { label: "Business",      color: "var(--sun)" },
  other_asset: { label: "Other assets",  color: "var(--sand)" },
  // Legacy free-tier categories
  savings:     { label: "Savings",       color: "var(--mint)" },
  real_estate: { label: "Real estate",   color: "var(--forest)" },
};

const LIABILITY_CATEGORIES: Record<string, { label: string; color: string }> = {
  mortgage:         { label: "Mortgage",      color: "var(--clay-ink)" },
  personal_loan:    { label: "Personal loan", color: "var(--clay)" },
  credit_card:      { label: "Credit card",   color: "#F2A98A" },
  business_debt:    { label: "Business debt", color: "var(--clay-ink)" },
  other_liability:  { label: "Other",         color: "#F6C7B4" },
  // Legacy
  car_loan:         { label: "Car loan",      color: "var(--clay)" },
  student_loan:     { label: "Student loan",  color: "#F2A98A" },
  other:            { label: "Other debt",    color: "#F6C7B4" },
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
      color: ASSET_CATEGORIES[cat]?.color ?? "var(--ink-20)",
      pct: totalAssets > 0 ? (v / totalAssets) * 100 : 0,
    }));

  const liabSegments = Object.entries(liabilityByCategory)
    .filter(([, v]) => v > 0)
    .map(([cat, v]) => ({
      cat,
      value: v,
      label: LIABILITY_CATEGORIES[cat]?.label ?? cat,
      color: LIABILITY_CATEGORIES[cat]?.color ?? "var(--clay)",
      pct: totalLiabilities > 0 ? (v / totalLiabilities) * 100 : 0,
    }));

  if (assetSegments.length === 0 && liabSegments.length === 0) {
    return (
      <div className="bg-surface border border-hairline rounded-[18px] p-4 text-sm text-ink-40 text-center">
        Add your assets and liabilities to see your breakdown.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-hairline rounded-[18px] p-4 space-y-4">
      <p className="text-xs font-semibold text-ink-40 uppercase tracking-wide">Breakdown</p>

      {/* Asset bar */}
      {assetSegments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-40">Assets</p>
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
                <span className={hovered === seg.cat ? "font-semibold text-forest" : "text-ink-40"}>
                  {seg.label}
                </span>
                <span className="font-medium text-forest">{fmtUsd(seg.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liability bar */}
      {liabSegments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-40">Liabilities</p>
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
                <span className="text-ink-40">{seg.label}</span>
                <span className="font-medium text-clay">{fmtUsd(seg.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
