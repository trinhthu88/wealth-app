import { Link } from "wouter";
import CurrencyField from "@/components/shared/CurrencyField";
import type { NetWorthSummary } from "@/hooks/useDashboardData";

interface Props {
  netWorth: NetWorthSummary | null;
}

function Ring({ pct, netWorth, displayCurrency }: { pct: number; netWorth: number; displayCurrency: string }) {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 56;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, pct)));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Net worth ring showing ${(pct * 100).toFixed(0)}%`}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
        {/* Arc */}
        {pct > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#1D9E75"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <span className="text-base font-bold text-[#042C53] leading-tight">
          {netWorth >= 0 ? "" : "-"}$
          {Math.abs(netWorth).toLocaleString("en-US", { maximumFractionDigits: 0, notation: "compact" } as any)}
        </span>
        <span className="text-[10px] text-[#64748B] leading-tight">net worth</span>
      </div>
    </div>
  );
}

export default function NetWorthRingSection({ netWorth }: Props) {
  const isEmpty = !netWorth || netWorth.totalAssets === 0;
  const pct = netWorth && netWorth.totalAssets > 0
    ? Math.max(0, Math.min(1, netWorth.netWorth / netWorth.totalAssets))
    : 0;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-4 h-full">
      <p className="text-sm font-semibold text-[#042C53]">Net worth</p>

      {isEmpty ? (
        <div className="flex flex-col items-center py-4 space-y-2">
          <Ring pct={0} netWorth={0} displayCurrency="USD" />
          <p className="text-sm text-[#64748B] text-center">Track your assets and liabilities.</p>
          <Link href="/client/networth">
            <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">Set up net worth →</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-3">
          <Ring pct={pct} netWorth={netWorth!.netWorth} displayCurrency="USD" />
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748B]">Assets</span>
              <span className="font-medium text-[#042C53]">
                <CurrencyField amountUsd={netWorth!.totalAssets} compact />
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#64748B]">Liabilities</span>
              <span className="font-medium text-red-500">
                -<CurrencyField amountUsd={netWorth!.totalLiabilities} compact />
              </span>
            </div>
          </div>
          <div className="w-full flex justify-end">
            <Link href="/client/networth">
              <span className="text-sm font-medium text-[#1D9E75] hover:text-[#0F6E56]">View net worth →</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
