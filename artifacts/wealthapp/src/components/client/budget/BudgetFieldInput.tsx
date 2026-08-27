export interface BudgetFormState {
  primaryIncome: string;
  secondaryIncome: string;
  rentalIncome: string;
  otherIncome: string;
  housing: string;
  utilities: string;
  transport: string;
  insurance: string;
  foodDining: string;
  entertainment: string;
  shopping: string;
  health: string;
  education: string;
  otherExpenses: string;
  otherInvestments: string;
}

export const INCOME_CATEGORIES = [
  { key: "primaryIncome",   label: "Primary income (take-home, after tax)" },
  { key: "secondaryIncome", label: "Secondary income" },
  { key: "rentalIncome",    label: "Rental income" },
  { key: "otherIncome",     label: "Other income" },
] as const;

export const EXPENSE_CATEGORIES = [
  { key: "housing",       label: "Housing (rent / mortgage)" },
  { key: "utilities",     label: "Utilities & bills" },
  { key: "transport",     label: "Transport" },
  { key: "insurance",     label: "Insurance" },
  { key: "foodDining",    label: "Food & dining" },
  { key: "entertainment", label: "Entertainment" },
  { key: "shopping",      label: "Shopping" },
  { key: "health",        label: "Health" },
  { key: "education",     label: "Education" },
  { key: "otherExpenses", label: "Other expenses" },
] as const;

export function n(s: string) { return parseFloat(s) || 0; }

export function totalOf(form: BudgetFormState, categories: readonly { key: keyof BudgetFormState }[]) {
  return categories.reduce((sum, cat) => sum + n(form[cat.key]), 0);
}
