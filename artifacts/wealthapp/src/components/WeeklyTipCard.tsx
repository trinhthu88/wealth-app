import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, ChevronRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tip } from "@/lib/tipEngine";

interface Props {
  tip: Tip;
}

const TYPE_COLORS: Record<string, string> = {
  goal_alert: "border-l-red-400",
  benchmark: "border-l-blue-400",
  expat_tip: "border-l-purple-400",
  score_tip: "border-l-amber-400",
  milestone: "border-l-emerald-400",
  market_context: "border-l-teal-400",
};

const TYPE_ICON_BG: Record<string, string> = {
  goal_alert: "bg-red-100 text-red-600",
  benchmark: "bg-blue-100 text-blue-600",
  expat_tip: "bg-purple-100 text-purple-600",
  score_tip: "bg-amber-100 text-amber-600",
  milestone: "bg-emerald-100 text-emerald-600",
  market_context: "bg-teal-100 text-teal-600",
};

const TYPE_LABEL: Record<string, string> = {
  goal_alert: "GOAL ALERT",
  benchmark: "PEER BENCHMARK",
  expat_tip: "EXPAT TIP",
  score_tip: "SCORE TIP",
  milestone: "MILESTONE",
  market_context: "MARKET INSIGHT",
};

const LS_KEY = "wealthapp_tip_dismissed_v1";

function getThisWeekKey(): string {
  const d = new Date();
  const monday = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

export default function WeeklyTipCard({ tip }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const weekKey = getThisWeekKey();
    const stored = localStorage.getItem(LS_KEY);
    if (stored === weekKey) setDismissed(true);
  }, []);

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(LS_KEY, getThisWeekKey());
    setDismissed(true);
  }

  const borderColor = TYPE_COLORS[tip.type] ?? "border-l-teal-400";
  const iconBg = TYPE_ICON_BG[tip.type] ?? "bg-teal-100 text-teal-600";
  const typeLabel = TYPE_LABEL[tip.type] ?? "INSIGHT";

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-2xl p-4 border-l-4 relative",
        borderColor,
      )}
    >
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground mb-0.5">
            {typeLabel}
          </div>
          <div className="font-semibold text-sm mb-1">{tip.title}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">{tip.body}</p>
          {tip.actionLabel && tip.actionRoute && (
            <Link
              href={tip.actionRoute}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-2 hover:underline"
            >
              {tip.actionLabel}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
