import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X, ArrowUpRight, Lightbulb, Users, Globe, Gauge, Award, LineChart, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tip } from "@/lib/tipEngine";

interface Props {
  tip: Tip;
}

// Full-strength icon tiles (approved design): Spring Field for wins, Blue
// Breeze for information, Sunset Pop for a goal that needs attention. Text on
// every tile stays Cobalt.
const TYPE_ICON_TILE: Record<string, string> = {
  goal_alert: "bg-sun",
  benchmark: "bg-breeze",
  expat_tip: "bg-breeze",
  score_tip: "bg-field",
  milestone: "bg-field",
  market_context: "bg-breeze",
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

  const iconTile = TYPE_ICON_TILE[tip.type] ?? "bg-breeze";
  const Icon = TYPE_ICON[tip.type] ?? Lightbulb;
  const typeLabel = TYPE_LABEL[tip.type] ?? "Insight";
  // Free users meet an advisor on the Advisor tab, not the old booking page.
  const actionHref = tip.actionRoute === "/book" ? "/free/advisor" : tip.actionRoute;

  return (
    <section aria-label={typeLabel} className="relative flex items-start gap-3 rounded-[24px] bg-surface p-4 pr-12">
      <div className={cn("flex h-11 w-11 flex-none items-center justify-center rounded-[14px] text-forest", iconTile)} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="tala-eyebrow text-ink-40">{typeLabel}</div>
        <h3 className="mt-1 text-[14px] font-semibold leading-[1.4] text-forest text-pretty">{tip.title}</h3>
        <p className="mt-1 text-[13px] leading-[1.5] text-ink-40 text-pretty">{tip.body}</p>
        {tip.actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-full bg-forest px-4 text-[13px] font-semibold text-paper transition-opacity hover:opacity-90"
          >
            {tip.actionLabel}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-30 transition-colors hover:text-forest"
        aria-label="Dismiss this week's tip"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
