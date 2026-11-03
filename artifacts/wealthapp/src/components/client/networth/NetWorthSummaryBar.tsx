import { useState } from "react";
import type { SyncedAsset, ManualAsset } from "@/hooks/useNetWorthItems";

const ASSET_CATEGORIES: Record<string, { label: string; color: string }> = {
  investment:  { label: "Investments",   color: "var(--forest)" },
  property:    { label: "Property",      color: "var(--field)" },
  cash:        { label: "Cash & savings",color: "var(--breeze)" },
  pension:     { label: "Pension",       color: "var(--violet)" },
  business:    { label: "Business",      color: "var(--mint-dim)" },
  other_asset: { label: "Other assets",  color: "var(--ink-20)" },
  // Legacy free-tier categories
  savings:     { label: "Savings",       color: "var(--breeze)" },
  real_estate: { label: "Real estate",   color: "var(--field)" },
};

const LIABILITY_CATEGORIES: Record<string, { label: string; color: string }> = {
  mortgage:         { label: "Mortgage",      color: "var(--forest)" },
  personal_loan:    { label: "Personal loan", color: "var(--violet)" },
  credit_card:      { label: "Credit card",   color: "var(--breeze)" },
  business_debt:    { label: "Business debt", color: "var(--mint-dim)" },
  other_liability:  { label: "Other",         color: "var(--ink-20)" },
  // Legacy
  car_loan:         { label: "Car loan",      color: "var(--violet)" },
  student_loan:     { label: "Student loan",  color: "var(--breeze)" },
  other:            { label: "Other debt",    color: "var(--ink-20)" },
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
      color: LIABILITY_CATEGORIES[cat]?.color ?? "var(--ink-20)",
      pct: totalLiabilities > 0 ? (v / totalLiabilities) * 100 : 0,
    }));

  if (assetSegments.length === 0 && liabSegments.length === 0) {
    return (
      <div className="bg-surface rounded-[24px] p-5 text-[14px] text-ink-40 text-center">
        Add your assets and liabilities to see your breakdown.
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-[24px] p-5 space-y-5">
      <h2 className="text-[16px] font-semibold text-forest">Breakdown</h2>

      {/* Asset bar */}
      {assetSegments.length > 0 && (
        <div className="space-y-2">
          <p className="tala-eyebrow text-ink-40">Assets</p>
          <div className="flex gap-0.5 rounded-full overflow-hidden h-3">
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
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {assetSegments.map(seg => (
              <div
                key={seg.cat}
                className="flex items-center gap-1.5 text-[13px]"
                onMouseEnter={() => setHovered(seg.cat)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className={hovered === seg.cat ? "font-medium text-forest" : "text-ink-40"}>
                  {seg.label}
                </span>
                <span className="font-semibold tabular-nums text-forest">{fmtUsd(seg.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liability bar */}
      {liabSegments.length > 0 && (
        <div className="space-y-2">
          <p className="tala-eyebrow text-ink-40">Liabilities</p>
          <div className="flex gap-0.5 rounded-full overflow-hidden h-2">
            {liabSegments.map(seg => (
              <div
                key={seg.cat}
                style={{ width: `${seg.pct}%`, background: seg.color }}
                className="transition-all cursor-default"
                title={`${seg.label}: ${fmtUsd(seg.value)}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {liabSegments.map(seg => (
              <div key={seg.cat} className="flex items-center gap-1.5 text-[13px]">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className="text-ink-40">{seg.label}</span>
                <span className="font-semibold tabular-nums text-forest">{fmtUsd(seg.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
