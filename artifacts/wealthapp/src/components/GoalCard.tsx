import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, TrendingUp } from "lucide-react";
import type { ProjectionResult } from "@/lib/goalProjection";

const GOAL_EMOJI: Record<string, string> = {
  property: "🏠", home_purchase: "🏠",
  retirement: "🌴",
  emergency_fund: "🛡️",
  fi: "🚀", financial_independence: "🚀",
  debt: "💳", debt_payoff: "💳",
  other: "🎯", education: "🎓",
  travel: "✈️", vehicle: "🚗", business: "💼",
};

export interface Goal {
  id: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string | null;
  monthlyContribution: string | null;
  currency: string;
  status: string;
  targetDate?: string | null;
}

interface Props {
  goal: Goal;
  projection?: ProjectionResult;
  onContribute?: () => void;
  onEdit?: () => void;
  /** Savings + investment balances working toward this goal (shown as context, not as "saved") */
  accountsBalance?: number;
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return (n < 0 ? "-$" : "$") + (Math.abs(n) / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1000) return (n < 0 ? "-$" : "$") + Math.round(Math.abs(n) / 1000) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function GrowthChip({ amount, bgClass, textClass }: { amount: number; bgClass: string; textClass: string }) {
  if (amount <= 0) return null;
  return (
    <div className={cn("flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 w-fit", bgClass, textClass)}>
      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
      <span>+{fmt(amount)}/month from savings interest &amp; investment returns</span>
    </div>
  );
}

function BreakdownCard({ projection, currentMonthlyPace }: { projection: ProjectionResult; currentMonthlyPace: number }) {
  const isOffTrack = !projection.onTrack;
  const rows = [
    { label: "Months remaining", value: `${projection.monthsRemaining} mo` },
    { label: "Required monthly", value: fmt(projection.requiredMonthlySaving) },
    { label: "Your current pace", value: fmt(currentMonthlyPace), positive: true },
    ...(isOffTrack && projection.monthlyShortfall > 0 ? [{ label: "Monthly shortfall", value: `-${fmt(projection.monthlyShortfall)}`, red: true }] : []),
    { label: projection.onTrack ? "Projected at target date" : "Projected at target date", value: fmt(projection.projectedAmount) },
  ];
  return (
    <div className="bg-white rounded-xl p-4 border border-white/60 shadow-sm space-y-2.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn("font-semibold", r.red ? "text-red-600" : r.positive ? "text-foreground" : "text-foreground")}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function AdvisorCTA({ offTrack, shortfall }: { offTrack: boolean; shortfall: number }) {
  return (
    <div className="bg-[#042C53] rounded-xl p-4">
      <p className="text-white text-sm font-medium mb-1">
        {offTrack ? "This gap needs a professional strategy" : "Small optimisations could close this gap"}
      </p>
      {offTrack && shortfall > 0 ? (
        <p className="text-blue-200 text-xs mb-3">
          A {fmt(shortfall)} shortfall over {Math.floor(shortfall / (shortfall / 12))} years is solvable with the right investment plan. Let's talk.
        </p>
      ) : (
        <p className="text-blue-200 text-xs mb-3">An advisor can identify small adjustments to get you fully on track.</p>
      )}
      <a href="/book" className="inline-flex items-center gap-1.5 bg-white text-[#042C53] text-xs font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-white/90">
        Book a free call
      </a>
    </div>
  );
}

function ActionButtons({ onContribute, onEdit, btnClass }: { onContribute?: () => void; onEdit?: () => void; btnClass: string }) {
  return (
    <div className="flex gap-2">
      {onContribute && (
        <Button size="sm" className={cn("flex-1 gap-1.5", btnClass)} onClick={onContribute}>
          <PlusCircle className="h-3.5 w-3.5" />Add contribution
        </Button>
      )}
      {onEdit && (
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
      )}
    </div>
  );
}

export default function GoalCard({ goal, projection, onContribute, onEdit, accountsBalance }: Props) {
  const storedCurrent = parseFloat(goal.currentAmount ?? "0");
  // Progress bar uses manual contributions only — accounts shown separately as context
  const current = storedCurrent;
  const target = parseFloat(goal.targetAmount ?? "0");
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const emoji = GOAL_EMOJI[goal.goalType] ?? "🎯";
  const status: string = projection?.status ?? goal.status;
  const isAchieved = status === "achieved" || (target > 0 && current >= target);
  const growthAmount = projection?.monthlyGrowthFromReturns ?? 0;

  // Current monthly pace = actual cash saved + returns from savings/investments
  const currentMonthlyPace = (projection?.currentMonthlyCash ?? 0) + (projection?.monthlyGrowthFromReturns ?? 0);

  const targetDateStr = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  function Header({ badge }: { badge: React.ReactNode }) {
    return (
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl bg-white/60">
            {emoji}
          </div>
          <div>
            <div className="font-semibold">{goal.title}</div>
            {targetDateStr && <div className="text-xs text-muted-foreground mt-0.5">by {targetDateStr}</div>}
          </div>
        </div>
        {badge}
      </div>
    );
  }

  function ProgressSection({ barClass }: { barClass: string }) {
    return (
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <div>
            <span className="font-medium">{current > 0 ? `${fmt(current)} saved` : "Not started"}</span>
            {accountsBalance && accountsBalance > 0 && (
              <span className="text-muted-foreground ml-1.5">· {fmt(accountsBalance)} in accounts</span>
            )}
          </div>
          <span className="text-muted-foreground">{target > 0 ? fmt(target) : "—"} by {targetDateStr ?? "target"}</span>
        </div>
        <div className="h-2 rounded-full bg-white/60 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", barClass)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (isAchieved) {
    return (
      <div className="bg-gradient-to-br from-primary/10 to-emerald-50 border border-primary/30 rounded-2xl p-5 space-y-4">
        <Header badge={<span className="text-xs bg-primary text-white px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">🎉 Achieved!</span>} />
        <ProgressSection barClass="bg-primary" />
        <p className="text-sm text-primary font-medium text-center py-1">Goal reached — {fmt(current)} saved!</p>
      </div>
    );
  }

  if (status === "on_track") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
        <Header badge={<span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">✓ On track</span>} />
        <ProgressSection barClass="bg-emerald-500" />
        <GrowthChip amount={growthAmount} bgClass="bg-emerald-100" textClass="text-emerald-800" />
        {projection && <BreakdownCard projection={projection} currentMonthlyPace={currentMonthlyPace} />}
        <ActionButtons onContribute={onContribute} onEdit={onEdit} btnClass="" />
      </div>
    );
  }

  if (status === "almost") {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-4">
        <Header badge={<span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">⚠ Almost there</span>} />
        <ProgressSection barClass="bg-amber-500" />
        <GrowthChip amount={growthAmount} bgClass="bg-amber-100" textClass="text-amber-800" />
        {projection && <BreakdownCard projection={projection} currentMonthlyPace={currentMonthlyPace} />}
        {projection && <AdvisorCTA offTrack={false} shortfall={projection.projectedShortfall} />}
        <ActionButtons onContribute={onContribute} onEdit={onEdit} btnClass="bg-amber-600 hover:bg-amber-700" />
      </div>
    );
  }

  // Off track
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-4">
      <Header badge={<span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">Off track</span>} />
      <ProgressSection barClass="bg-red-500" />
      <GrowthChip amount={growthAmount} bgClass="bg-red-100" textClass="text-red-800" />
      {projection && <BreakdownCard projection={projection} currentMonthlyPace={currentMonthlyPace} />}
      {projection && <AdvisorCTA offTrack={true} shortfall={projection.projectedShortfall} />}
      <ActionButtons onContribute={onContribute} onEdit={onEdit} btnClass="bg-red-600 hover:bg-red-700" />
    </div>
  );
}
