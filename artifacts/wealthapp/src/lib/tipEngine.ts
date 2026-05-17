export interface TipData {
  effectiveSavingsRate: number;
  healthScore: number;
  goal: { title: string; monthlyShortfall?: number } | null;
  goalStatus: string;
  ageBenchmarkSavingsRate: number;
  streakWeeks: number;
  isExpat: boolean;
  investmentRatePercent: number;
}

export interface Tip {
  type: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionRoute?: string;
}

export function generateWeeklyTip(data: TipData): Tip {
  const {
    effectiveSavingsRate,
    healthScore,
    goal,
    goalStatus,
    ageBenchmarkSavingsRate,
    streakWeeks,
    isExpat,
    investmentRatePercent,
  } = data;

  if (goal && goalStatus === "off_track") {
    return {
      type: "goal_alert",
      title: "Your goal needs attention",
      body: `Your "${goal.title}" is off track. An advisor can help close the gap without requiring you to save more each month.`,
      actionLabel: "See breakdown",
      actionRoute: "/free/goals",
    };
  }

  if (goal && goalStatus === "almost") {
    return {
      type: "goal_alert",
      title: "You're almost on track",
      body: `Your "${goal.title}" is within reach — just $${Math.round(goal.monthlyShortfall ?? 0).toLocaleString()}/month more would put you fully on track.`,
      actionLabel: "Update my budget",
      actionRoute: "/free/budget",
    };
  }

  if (effectiveSavingsRate < ageBenchmarkSavingsRate) {
    return {
      type: "benchmark",
      title: "Your savings vs your peers",
      body: `You're saving ${effectiveSavingsRate.toFixed(0)}% effectively. People your age average ${ageBenchmarkSavingsRate}%. Closing this gap adds years to your retirement date.`,
      actionLabel: "Review my budget",
      actionRoute: "/free/budget",
    };
  }

  if (isExpat && investmentRatePercent < 5) {
    return {
      type: "expat_tip",
      title: "Are your investments expat-optimised?",
      body: "As an expat, local investment accounts may offer better returns than home country accounts. An advisor can review your options.",
      actionLabel: "Book a free review",
      actionRoute: "/book",
    };
  }

  if (healthScore < 60) {
    return {
      type: "score_tip",
      title: "Three quick wins for your score",
      body: `Your score is ${healthScore}/100. Reach 20% savings (+5 pts), complete your pathway (+5 pts), and set a goal target date (+5 pts).`,
      actionLabel: "See my score",
      actionRoute: "/free/healthscore",
    };
  }

  if (streakWeeks >= 4) {
    return {
      type: "milestone",
      title: `${streakWeeks}-week streak — you're building something real`,
      body: "Consistent financial tracking is one of the strongest predictors of long-term wealth. You're in the top 20% for engagement.",
      actionLabel: "View achievements",
      actionRoute: "/free/dashboard",
    };
  }

  return {
    type: "market_context",
    title: "Are your savings working hard enough?",
    body: "Vietnam bank deposit rates average 4.5–5.2% in 2025. Make sure your savings rate reflects what you're actually earning.",
    actionLabel: "Update savings rate",
    actionRoute: "/free/dashboard",
  };
}

export function getAgeBenchmarkSavingsRate(age: number | null): number {
  if (!age) return 14;
  if (age <= 35) return 14;
  if (age <= 40) return 17;
  return 20;
}
