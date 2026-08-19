export interface MilestoneCheck {
  goalsCount: number;
  pathwayComplete: boolean;
  streakWeeks: number;
  netWorth: number;
  effectiveSavingsRate: number;
  goalOnTrack: boolean;
  healthScore: number;
  budgetMonthsCount: number;
}

export const MILESTONES = [
  {
    key: "goal_setter",
    label: "Goal setter",
    desc: "Set your first financial goal",
    check: (d: MilestoneCheck) => d.goalsCount >= 1,
  },
  {
    key: "plan_starter",
    label: "Plan starter",
    desc: "Complete the 6-step pathway",
    check: (d: MilestoneCheck) => d.pathwayComplete,
  },
  {
    key: "streak_4",
    label: "4-week streak",
    desc: "Check in 4 weeks in a row",
    check: (d: MilestoneCheck) => d.streakWeeks >= 4,
  },
  {
    key: "streak_12",
    label: "3-month streak",
    desc: "Check in every week for 3 months",
    check: (d: MilestoneCheck) => d.streakWeeks >= 12,
  },
  {
    key: "net_worth_pos",
    label: "Net worth positive",
    desc: "Assets exceed liabilities",
    check: (d: MilestoneCheck) => d.netWorth > 0,
  },
  {
    key: "saver_20",
    label: "20% saver",
    desc: "Reach 20% effective savings rate",
    check: (d: MilestoneCheck) => d.effectiveSavingsRate >= 20,
  },
  {
    key: "goal_on_track",
    label: "On the money",
    desc: "Goal fully on track",
    check: (d: MilestoneCheck) => d.goalOnTrack,
  },
  {
    key: "score_70",
    label: "Score 70+",
    desc: "Health score above 70",
    check: (d: MilestoneCheck) => d.healthScore >= 70,
  },
  {
    key: "score_80",
    label: "Score 80+",
    desc: "Health score above 80",
    check: (d: MilestoneCheck) => d.healthScore >= 80,
  },
  {
    key: "budget_3months",
    label: "Budget habit",
    desc: "Updated budget 3 months in a row",
    check: (d: MilestoneCheck) => d.budgetMonthsCount >= 3,
  },
];

const LS_KEY = "wealthapp_milestones_v1";
const LS_STREAK_KEY = "wealthapp_streak_v1";
const LS_STREAK_DATE_KEY = "wealthapp_streak_date_v1";

export function getEarnedMilestones(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function checkAndAwardMilestones(data: MilestoneCheck): string[] {
  const earned = getEarnedMilestones();
  const newlyEarned: string[] = [];
  for (const m of MILESTONES) {
    if (earned.includes(m.key)) continue;
    if (m.check(data)) newlyEarned.push(m.key);
  }
  if (newlyEarned.length > 0) {
    localStorage.setItem(LS_KEY, JSON.stringify([...earned, ...newlyEarned]));
  }
  return newlyEarned;
}

export function getStreak(): { weeks: number; lastDate: string | null } {
  try {
    const weeks = parseInt(localStorage.getItem(LS_STREAK_KEY) ?? "0", 10);
    const lastDate = localStorage.getItem(LS_STREAK_DATE_KEY);
    return { weeks: isNaN(weeks) ? 0 : weeks, lastDate };
  } catch {
    return { weeks: 0, lastDate: null };
  }
}

export function recordCheckin(): number {
  const { weeks, lastDate } = getStreak();
  const today = new Date().toISOString().slice(0, 10);
  const lastWeekStart = lastDate
    ? new Date(lastDate)
    : null;
  const nowWeekStart = getWeekStart(new Date());

  let newWeeks = weeks;
  if (!lastWeekStart) {
    newWeeks = 1;
  } else {
    const lastWS = getWeekStart(lastWeekStart);
    const diffMs = nowWeekStart.getTime() - lastWS.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks === 1) newWeeks = weeks + 1;
    else if (diffWeeks === 0) newWeeks = weeks;
    else newWeeks = 1;
  }

  localStorage.setItem(LS_STREAK_KEY, String(newWeeks));
  localStorage.setItem(LS_STREAK_DATE_KEY, today);
  return newWeeks;
}

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getRatesFromStorage(): { savingsRate: number; investmentRate: number } {
  try {
    return {
      savingsRate: parseFloat(localStorage.getItem("wealthapp_savings_rate") ?? "4.0"),
      investmentRate: parseFloat(
        localStorage.getItem("wealthapp_investment_rate") ?? "7.0",
      ),
    };
  } catch {
    return { savingsRate: 4.0, investmentRate: 7.0 };
  }
}

export function saveRatesToStorage(savingsRate: number, investmentRate: number) {
  localStorage.setItem("wealthapp_savings_rate", String(savingsRate));
  localStorage.setItem("wealthapp_investment_rate", String(investmentRate));
}
