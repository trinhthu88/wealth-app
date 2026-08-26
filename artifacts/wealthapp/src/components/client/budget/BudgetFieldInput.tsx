import {
  Briefcase, Building2, Landmark, Sparkles,
  Home, Zap, Bus, Shield, Utensils, Film, ShoppingBag, HeartPulse, BookOpen, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { key: "primaryIncome",   icon: <Briefcase className="w-4 h-4 text-forest mr-2" />, label: "Primary income (take-home, after tax)" },
  { key: "secondaryIncome", icon: <Building2 className="w-4 h-4 text-forest mr-2" />, label: "Secondary income", placeholder: "Freelance, consulting…" },
  { key: "rentalIncome",    icon: <Landmark className="w-4 h-4 text-forest mr-2" />, label: "Rental income", placeholder: "From investment properties" },
  { key: "otherIncome",     icon: <Sparkles className="w-4 h-4 text-forest mr-2" />, label: "Other income", placeholder: "Dividends, bonuses…" },
] as const;

export const EXPENSE_CATEGORIES = [
  { key: "housing",       icon: <Home className="w-4 h-4 text-forest mr-2" />, label: "Housing (rent / mortgage)" },
  { key: "utilities",     icon: <Zap className="w-4 h-4 text-forest mr-2" />, label: "Utilities & bills" },
  { key: "transport",     icon: <Bus className="w-4 h-4 text-forest mr-2" />, label: "Transport" },
  { key: "insurance",     icon: <Shield className="w-4 h-4 text-forest mr-2" />, label: "Insurance" },
  { key: "foodDining",    icon: <Utensils className="w-4 h-4 text-forest mr-2" />, label: "Food & dining" },
  { key: "entertainment", icon: <Film className="w-4 h-4 text-forest mr-2" />, label: "Entertainment" },
  { key: "shopping",      icon: <ShoppingBag className="w-4 h-4 text-forest mr-2" />, label: "Shopping" },
  { key: "health",        icon: <HeartPulse className="w-4 h-4 text-forest mr-2" />, label: "Health" },
  { key: "education",     icon: <BookOpen className="w-4 h-4 text-forest mr-2" />, label: "Education" },
  { key: "otherExpenses", icon: <MoreHorizontal className="w-4 h-4 text-forest mr-2" />, label: "Other expenses" },
] as const;

export function n(s: string) { return parseFloat(s) || 0; }

export function totalOf(form: BudgetFormState, categories: readonly { key: keyof BudgetFormState }[]) {
  return categories.reduce((sum, cat) => sum + n(form[cat.key]), 0);
}

export function NumberInput({
  label, value, onChange, placeholder, readOnly,
}: {
  label: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center text-xs font-medium text-ink-40">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        min={0}
        readOnly={readOnly}
        style={{ MozAppearance: "textfield" } as React.CSSProperties}
        className={cn(
          "w-full min-h-11 px-3 py-2 rounded-xl border text-sm text-forest focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          readOnly
            ? "bg-paper border-hairline text-ink-30 cursor-default"
            : "border-hairline bg-surface"
        )}
      />
    </div>
  );
}
