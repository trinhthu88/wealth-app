// Labels for the milestones the server awards (see api-server/src/lib/engagement.ts).
export const MILESTONES = [
  {
    key: "goal_setter",
    label: "Goal setter",
    desc: "Set your first financial goal",
  },
  {
    key: "plan_starter",
    label: "Plan starter",
    desc: "Finish onboarding",
  },
  {
    key: "streak_4",
    label: "4-week streak",
    desc: "Check in 4 weeks in a row",
  },
  {
    key: "streak_12",
    label: "3-month streak",
    desc: "Check in every week for 3 months",
  },
  {
    key: "net_worth_pos",
    label: "Net worth positive",
    desc: "Assets exceed liabilities",
  },
  {
    key: "saver_20",
    label: "20% saver",
    desc: "Reach 20% effective savings rate",
  },
  {
    key: "goal_on_track",
    label: "On the money",
    desc: "Goal fully on track",
  },
  {
    key: "score_70",
    label: "Score 70+",
    desc: "Health score above 70",
  },
  {
    key: "score_80",
    label: "Score 80+",
    desc: "Health score above 80",
  },
  {
    key: "budget_3months",
    label: "Budget habit",
    desc: "Updated budget 3 months in a row",
  },
];

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
