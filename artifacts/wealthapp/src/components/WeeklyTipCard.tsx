import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, ArrowUpRight, Lightbulb, Users, Globe, Gauge, Award, LineChart, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tip } from "@/lib/tipEngine";

interface Props {
  tip: Tip;
}

// Calm icon tiles: Spring Field / Blue Breeze for information, Sunset Pop
// tint only for a goal that needs attention.
const TYPE_ICON_TILE: Record<string, string> = {
  goal_alert: "bg-sun-tint text-amber-ink",
  benchmark: "bg-breeze text-forest",
  expat_tip: "bg-breeze text-forest",
  score_tip: "bg-field text-forest",
  milestone: "bg-field text-forest",
  market_context: "bg-breeze text-forest",
};

const TYPE_ICON: Record<string, LucideIcon> = {
  goal_alert: AlertCircle,
  benchmark: Users,
  expat_tip: Globe,
  score_tip: Gauge,
  milestone: Award,
  market_context: LineChart,
};

const TYPE_LABEL: Record<string, string> = {
  goal_alert: "Goal alert",
  benchmark: "Peer benchmark",
  expat_tip: "Expat tip",
  score_tip: "Score tip",
  milestone: "Milestone",
  market_context: "Market insight",
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

  const iconTile = TYPE_ICON_TILE[tip.type] ?? "bg-breeze text-forest";
  const Icon = TYPE_ICON[tip.type] ?? Lightbulb;
  const typeLabel = TYPE_LABEL[tip.type] ?? "Insight";

  return (
    <div className="bg-surface rounded-[24px] p-5 relative">
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 h-11 w-11 rounded-full flex items-center justify-center text-ink-30 hover:text-forest transition-colors"
        aria-label="Dismiss this week's tip"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className={cn("w-10 h-10 rounded-[14px] flex items-center justify-center flex-none", iconTile)} aria-hidden="true">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="tala-eyebrow text-ink-40">{typeLabel}</div>
          <h3 className="text-[15px] font-semibold text-forest mt-1 leading-[1.35]">{tip.title}</h3>
          <p className="text-[14px] text-ink-40 leading-[1.5] text-pretty mt-1">{tip.body}</p>
          {tip.actionLabel && tip.actionRoute && (
            <Link
              href={tip.actionRoute}
              className="inline-flex items-center gap-2 min-h-11 text-[14px] font-semibold text-green mt-1"
            >
              {tip.actionLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
