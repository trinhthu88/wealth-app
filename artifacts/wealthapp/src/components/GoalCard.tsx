import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlusCircle, Pencil } from "lucide-react";

const GOAL_EMOJI: Record<string, string> = {
  property: "🏠", home_purchase: "🏠",
  retirement: "🌴",
  emergency_fund: "🛡️",
  fi: "🚀", financial_independence: "🚀",
  debt: "💳", debt_payoff: "💳",
  other: "🎯",
  education: "🎓", travel: "✈️", vehicle: "🚗", business: "💼",
};

const STATUS_STYLES: Record<string, string> = {
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-amber-100 text-amber-700",
  off_track: "bg-red-100 text-red-700",
  achieved: "bg-primary/10 text-primary",
  paused: "bg-muted text-muted-foreground",
};

interface Goal {
  id: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string | null;
  currency: string;
  status: string;
  targetDate?: string | null;
}

interface Props {
  goal: Goal;
  onContribute?: () => void;
  onEdit?: () => void;
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency === "VND" ? "VND" : "USD", maximumFractionDigits: 0 }).format(n);
}

export default function GoalCard({ goal, onContribute, onEdit }: Props) {
  const current = parseFloat(goal.currentAmount ?? "0");
  const target = parseFloat(goal.targetAmount ?? "0");
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const emoji = GOAL_EMOJI[goal.goalType] ?? "🎯";

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
            {emoji}
          </div>
          <div>
            <div className="font-semibold">{goal.title}</div>
            {goal.targetDate && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Target: {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
        <span className={cn("text-xs px-2 py-1 rounded-full font-medium capitalize", STATUS_STYLES[goal.status] ?? STATUS_STYLES.on_track)}>
          {goal.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-primary">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="flex justify-between text-sm mb-4">
        <div>
          <div className="text-xs text-muted-foreground">Saved</div>
          <div className="font-semibold text-primary">{fmt(current, goal.currency)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Target</div>
          <div className="font-semibold">{target > 0 ? fmt(target, goal.currency) : "—"}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {onContribute && (
          <Button size="sm" className="flex-1 gap-1.5" onClick={onContribute}>
            <PlusCircle className="h-3.5 w-3.5" />Add contribution
          </Button>
        )}
        {onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
