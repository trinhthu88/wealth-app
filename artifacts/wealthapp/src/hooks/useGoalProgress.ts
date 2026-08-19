// Pure calculation hook — no DB calls.
export { computeGoalProgress } from "@workspace/goal-math";
export type { GoalStatus, GoalProgressResult } from "@workspace/goal-math";
import { computeGoalProgress, type GoalProgressResult } from "@workspace/goal-math";

export function useGoalProgress(goal: {
  currentAmount: number;
  targetAmount: number | null;
  targetDate: string | null;
  createdAt: string;
}): GoalProgressResult {
  return computeGoalProgress(goal);
}
