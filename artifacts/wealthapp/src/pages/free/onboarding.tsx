// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Step slide transition + expense row expand (framer-motion)
// ✓ ALLOWED: Confetti on completion, RewardReveal fade-in, Sol breathe on the completion hero
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#F1F4FE, #F1F4FE, #8F98C8)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  AppShell / FreeAppShell menu bar during onboarding — this is a standalone full-screen flow

import confetti from "canvas-confetti";
import { useState, useCallback, useRef, useMemo, useEffect, useId } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { queryClient } from "@/lib/queryClient";
import RewardReveal from "@/components/RewardReveal";
import Sol from "@/components/Sol";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, Minus, Plus, ShieldAlert, Briefcase, Home, Palmtree, Rocket, Target, Utensils, Bus, Zap, Ticket, MoreHorizontal, CreditCard, Building, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveRatesToStorage } from "@/lib/milestones";
import { track } from "@/lib/analytics";

interface Step { stepNumber: number; stepName: string; status: string; formData: Record<string, unknown>; }

const STEP_NAMES: Record<number, string> = {
  1: "About you",
  2: "Income",
  3: "Monthly expenses",
  4: "Goal",
  5: "Net worth snapshot",
  6: "Risk profile",
};

type FormData = {
  age: number; lifeStage: string; isExpat: boolean | null; currency: string;
  income: number; incomeTypes: string[]; stability: string;
  housing: number; food: number; transport: number; utilities: number; entertainment: number; other: number;
  goalType: string; goalTitle: string; goalTarget: number; goalMonth: string; goalYear: string;
  savings: number; investments: number; noInvestments: boolean; debts: number; debtFree: boolean;
  savingsRatePercent: number; investmentRatePercent: number;
  riskAnswers: (number | null)[];
};

const LIFE_STAGES = ["Just starting", "Building career", "Growing family", "Established", "Pre-retirement"];
const INCOME_TYPES = ["Salary", "Freelance", "Business", "Rental", "Other"];
const STABILITY = [{ label: "Very stable", icon: Building }, { label: "Mostly stable", icon: Briefcase }, { label: "Variable", icon: TrendingUp }];
const GOAL_OPTIONS = [
  { type: "property", icon: Home, name: "Buy property", desc: "Build your deposit" },
  { type: "retirement", icon: Palmtree, name: "Retire comfortably", desc: "Build enough to stop working" },
  { type: "emergency_fund", icon: ShieldAlert, name: "Emergency fund", desc: "3-6 months of expenses" },
  { type: "fi", icon: Rocket, name: "Financial independence", desc: "Reach your FI number" },
  { type: "debt", icon: CreditCard, name: "Pay off debt", desc: "Become debt-free" },
  { type: "other", icon: Target, name: "Other goal", desc: "Something personal" },
];
const RISK_QUESTIONS = [
  { q: "If your investments dropped 20%, you'd...", options: ["Sell everything immediately", "Feel anxious but hold on", "Stay calm and wait it out", "See it as a buying opportunity"] },
  { q: "Your main investment goal is...", options: ["Never lose money", "Steady growth, some security", "Balance growth and risk", "Maximum long-term growth"] },
  { q: "You plan to use this money in...", options: ["Less than 3 years", "3 to 7 years", "7 to 15 years", "15+ years"] },
  { q: "Your investment experience is...", options: ["None — just starting", "Some — tried a few things", "Moderate — invest regularly", "High — very comfortable"] },
  { q: "Your financial personality is...", options: ["Safety first, always", "Careful but open to some risk", "Balanced and thoughtful", "Growth-focused, long-term"] },
];
const RISK_PROFILES: Record<string, { name: string; desc: string; eq: number; bond: number; cash: number }> = {
  Conservative: { name: "Conservative", desc: "You prioritise protecting what you have over chasing growth.", eq: 40, bond: 40, cash: 20 },
  Moderate: { name: "Moderate", desc: "You seek steady growth with a cushion of security.", eq: 60, bond: 30, cash: 10 },
  Growth: { name: "Growth", desc: "You're comfortable with volatility for higher long-term returns.", eq: 80, bond: 15, cash: 5 },
  Aggressive: { name: "Aggressive", desc: "You're fully growth-focused and can ride out big swings.", eq: 95, bond: 5, cash: 0 },
};
// Display labels above map onto the one stored risk vocabulary (conservative | balanced | growth).
const RISK_PROFILE_STORED_VALUE: Record<string, "conservative" | "balanced" | "growth"> = {
  Conservative: "conservative",
  Moderate: "balanced",
  Growth: "growth",
  Aggressive: "growth",
};

function getRiskProfile(answers: (number | null)[]) {
  const total = answers.reduce<number>((s, a) => s + (a ?? 0), 0);
  if (total <= 8) return "Conservative";
  if (total <= 12) return "Moderate";
  if (total <= 16) return "Growth";
  return "Aggressive";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() + 1 + i));

// Tile colours follow the approved expenses screen (field / breeze / paper / sun).
const EXPENSE_CATS = [
  { key: "housing" as const, icon: Home, label: "Housing", tile: "bg-field" },
  { key: "food" as const, icon: Utensils, label: "Food", tile: "bg-breeze" },
  { key: "transport" as const, icon: Bus, label: "Transport", tile: "bg-breeze" },
  { key: "utilities" as const, icon: Zap, label: "Utilities", tile: "bg-paper" },
  { key: "entertainment" as const, icon: Ticket, label: "Entertainment", tile: "bg-sun" },
  { key: "other" as const, icon: MoreHorizontal, label: "Other", tile: "bg-paper" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -80, opacity: 0 }),
};


// Shared control styles — flat surfaces, explicit radii (rounded-2xl is pill-ish in this theme).
const INPUT_CLASS =
  "h-12 w-full rounded-[16px] border-0 bg-surface px-4 text-[15px] text-forest outline-none transition-shadow placeholder:text-ink-30 focus-visible:ring-2 focus-visible:ring-forest/30";
const SELECT_CLASS = cn(INPUT_CLASS, "appearance-none pr-10 cursor-pointer");
const FIELD_LABEL = "block px-1 mb-2.5 font-sans text-[16px] font-semibold text-forest";

/** Outlined choice: 1.5px Cobalt outline, fills Cobalt when selected. */
function choiceClass(selected: boolean, extra?: string) {
  return cn(
    "border-[1.5px] border-forest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30 active:scale-[0.98]",
    selected ? "bg-forest text-paper" : "bg-transparent text-forest hover:bg-surface",
    extra,
  );
}

/** Pill choice used for life stage, expat, currency and income sources. */
const PILL = "h-11 rounded-full px-[18px] text-[14px] font-semibold";

function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5 px-1">
      <h1 className="font-display text-[36px] leading-[1.05] text-forest text-balance">{title}</h1>
      <p className="mt-2 text-[14px] leading-[1.5] text-ink-40 text-pretty">{sub}</p>
    </div>
  );
}

/** Sol tip card (Blue Breeze) — one calm observation per step. */
function SolTip({ line }: { line: string }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-[24px] bg-breeze p-4 text-forest">
      <Sol size="sm" animate="breathe" />
      <div className="min-w-0 pt-0.5">
        <p className="tala-eyebrow text-forest/70">Sol</p>
        <p className="mt-1 text-[14px] font-semibold leading-[1.45] text-pretty">{line}</p>
      </div>
    </div>
  );
}

/** Compact money label for result tiles, e.g. $43.7k. */
function compactMoney(n: number, sym: string) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (v: number, suffix: string) => `${sign}${sym}${v.toFixed(v >= 100 ? 0 : 1).replace(/\.0$/, "")}${suffix}`;
  if (abs >= 1e9) return fmt(abs / 1e9, "B");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e3) return fmt(abs / 1e3, "k");
  return `${sign}${sym}${abs.toLocaleString()}`;
}

/** Row amount label: full grouping while it fits, compact for large (e.g. VND) values. */
function compactOrFull(n: number) {
  return n >= 100000 ? compactMoney(n, "") : n.toLocaleString();
}

function SelectField({ value, onChange, options, ariaLabel }: { value: string; onChange: (v: string) => void; options: string[]; ariaLabel: string }) {
  return (
    <div className="relative flex-1">
      <select aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
    </div>
  );
}

/**
 * Large money input for the wizard. Same behaviour as CurrencyField's editable
 * mode (raw number in `currency`, no conversion, grouping shown when blurred),
 * restyled to the large rounded tala input.
 */
function AmountField({ value, onChange, currency, label, tone = "surface" }: { value: number; onChange: (v: number) => void; currency: string; label?: string; tone?: "surface" | "paper" }) {
  const [focused, setFocused] = useState(false);
  const inputId = useId();
  const symbol = currency === "VND" ? "₫" : currency === "EUR" ? "€" : "$";
  const displayValue = focused ? (value === 0 ? "" : String(value)) : (value === 0 ? "" : value.toLocaleString());
  return (
    <div>
      {label && <label htmlFor={inputId} className={FIELD_LABEL}>{label}</label>}
      <div className={cn("flex h-16 items-center gap-2 rounded-[24px] px-5", tone === "paper" ? "bg-paper" : "bg-surface", "transition-shadow focus-within:ring-2 focus-within:ring-forest/30")}>
        <span className="text-[18px] font-medium text-ink-30 select-none" aria-hidden="true">{symbol}</span>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={displayValue}
          placeholder="0"
          aria-label={label ? undefined : `Amount in ${currency}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "");
            onChange(raw === "" ? 0 : parseFloat(raw) || 0);
          }}
          className="w-full min-w-0 flex-1 bg-transparent font-display tabular-nums text-[30px] leading-none text-forest outline-none placeholder:text-ink-20"
        />
        <span className="tala-eyebrow text-ink-30 select-none" aria-hidden="true">{currency}</span>
      </div>
    </div>
  );
}

function CheckToggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-40">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 rounded accent-[var(--forest)]" />
      {label}
    </label>
  );
}

export default function FreeOnboardingPage() {
  const { profile, update } = useProfile();
  const [, navigate] = useLocation();
  const search = useSearch();
  const stepParam = useMemo(() => {
    const s = new URLSearchParams(search).get("step");
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? Math.max(1, Math.min(6, n)) : null;
  }, [search]);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [showReward, setShowReward] = useState<null | 1 | 2>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepResumed, setStepResumed] = useState(false);
  const [riskSubStep, setRiskSubStep] = useState(0);
  const [riskAnswered, setRiskAnswered] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [goalPanel, setGoalPanel] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<FormData>({
    age: 30, lifeStage: "", isExpat: null, currency: "USD",
    income: 0, incomeTypes: [], stability: "",
    housing: 0, food: 0, transport: 0, utilities: 0, entertainment: 0, other: 0,
    goalType: "", goalTitle: "", goalTarget: 0, goalMonth: MONTHS[0], goalYear: YEARS[4],
    savings: 0, investments: 0, noInvestments: false, debts: 0, debtFree: false,
    savingsRatePercent: 4.0, investmentRatePercent: 7.0,
    riskAnswers: [null, null, null, null, null],
  });

  const { data: progress = [], isSuccess: progressLoaded, isLoading: progressLoading } = useQuery<Step[]>({
    queryKey: ["pathway"],
    queryFn: () => apiFetch<Step[]>("/pathway"),
  });

  // Pre-populate form from previously saved pathway progress
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated || !progress.length) return;
    const merged = progress.reduce<Record<string, unknown>>((acc, p) => ({ ...acc, ...((p.formData as Record<string, unknown>) ?? {}) }), {});
    setForm(f => ({
      ...f,
      age: (merged.age as number) ?? f.age,
      lifeStage: (merged.lifeStage as string) ?? f.lifeStage,
      isExpat: merged.isExpat !== undefined ? (merged.isExpat as boolean | null) : f.isExpat,
      currency: (merged.currency as string) ?? f.currency,
      income: (merged.income as number) ?? f.income,
      housing: (merged.housing as number) ?? f.housing,
      food: (merged.food as number) ?? f.food,
      transport: (merged.transport as number) ?? f.transport,
      utilities: (merged.utilities as number) ?? f.utilities,
      entertainment: (merged.entertainment as number) ?? f.entertainment,
      other: (merged.other as number) ?? f.other,
      goalType: (merged.goalType as string) ?? f.goalType,
      goalTitle: (merged.goalTitle as string) ?? f.goalTitle,
      goalTarget: (merged.goalTarget as number) ?? f.goalTarget,
      goalMonth: (merged.goalMonth as string) ?? f.goalMonth,
      goalYear: (merged.goalYear as string) ?? f.goalYear,
      savings: (merged.savings as number) ?? f.savings,
      investments: (merged.investments as number) ?? f.investments,
      debts: (merged.debts as number) ?? f.debts,
      savingsRatePercent: (merged.savingsRatePercent as number) ?? f.savingsRatePercent,
      investmentRatePercent: (merged.investmentRatePercent as number) ?? f.investmentRatePercent,
    }));
    setHydrated(true);
  }, [progress.length]);

  // Resume on refresh: jump to the first incomplete step; show summary if all done
  useEffect(() => {
    if (stepResumed || !progressLoaded) return;
    const completedNums = new Set(progress.filter(s => s.status === "completed").map(s => s.stepNumber));
    const allDone = [1, 2, 3, 4, 5, 6].every(n => completedNums.has(n));

    // If a specific step was requested via ?step=, jump there (allows editing from health score page etc.)
    if (stepParam) {
      setStep(stepParam - 1);
      setStepResumed(true);
      return;
    }

    // All steps complete and no specific step requested → nothing left to do here,
    // the ongoing summary now lives on the Pathway page.
    if (allDone) {
      navigate("/free/pathway", { replace: true });
      setStepResumed(true);
      return;
    }

    for (let i = 1; i <= 6; i++) {
      if (!completedNums.has(i)) {
        setStep(i - 1);
        break;
      }
    }
    setStepResumed(true);
  }, [progressLoaded, stepResumed, stepParam]);

  const saveStep = useMutation({
    mutationFn: ({ stepNumber, formData, status }: { stepNumber: number; formData: Record<string, unknown>; status: string }) =>
      apiFetch(`/pathway/${stepNumber}`, { method: "PUT", body: JSON.stringify({ stepName: `Step ${stepNumber}`, status, formData }) }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => { setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 1500); queryClient.invalidateQueries({ queryKey: ["pathway"] }); },
  });

  const autoSave = useCallback((stepNum: number, data: Record<string, unknown>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveStep.mutate({ stepNumber: stepNum, formData: data, status: "in_progress" }), 800);
  }, [saveStep]);

  const setField = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setForm(f => { const n = { ...f, [k]: v }; autoSave(step + 1, n as unknown as Record<string, unknown>); return n; });
  };

  const advance = (newStep: number) => { setDir(1); setStep(newStep); setStepError(null); };
  const back = () => { setDir(-1); setStep(s => Math.max(0, s - 1)); setStepError(null); };
  // Skip advances without saving; step status stays 'not_started'
  const skipStep = () => advance(Math.min(5, step + 1));

  const completedCount = progress.filter(s => s.status === "completed").length;

  async function finishStep(s: number) {
    setStepError(null);
    try {
      if (s === 1) {
        await saveStep.mutateAsync({ stepNumber: 1, formData: { age: form.age, lifeStage: form.lifeStage, isExpat: form.isExpat, currency: form.currency }, status: "completed" });
        track("onboarding_step_completed", { step: 1, stepName: STEP_NAMES[1] });
        update.mutate({ preferredCurrency: form.currency, isExpat: form.isExpat } as any);
        advance(1);
      } else if (s === 2) {
        await saveStep.mutateAsync({ stepNumber: 2, formData: { income: form.income }, status: "completed" });
        track("onboarding_step_completed", { step: 2, stepName: STEP_NAMES[2] });
        setShowReward(1);
      } else if (s === 3) {
        await saveStep.mutateAsync({ stepNumber: 3, formData: { housing: form.housing, food: form.food, transport: form.transport, utilities: form.utilities, entertainment: form.entertainment, other: form.other }, status: "completed" });
        track("onboarding_step_completed", { step: 3, stepName: STEP_NAMES[3] });
        // Save complete budget entry with income + all expenses so savings rate calculations work
        const budgetMonth = new Date().toISOString().slice(0, 7);
        await apiFetch("/budget", { method: "POST", body: JSON.stringify({
          periodMonth: budgetMonth,
          currency: form.currency,
          income: String(form.income),
          housing: String(form.housing),
          food: String(form.food),
          transport: String(form.transport),
          utilities: String(form.utilities),
          entertainment: String(form.entertainment),
          other: String(form.other),
        }) }).then(() => track("budget_saved", { month: budgetMonth })).catch(() => {});
        advance(3);
      } else if (s === 4) {
        await saveStep.mutateAsync({ stepNumber: 4, formData: { goalType: form.goalType, goalTitle: form.goalTitle, goalTarget: form.goalTarget, goalMonth: form.goalMonth, goalYear: form.goalYear }, status: "completed" });
        track("onboarding_step_completed", { step: 4, stepName: STEP_NAMES[4] });
        const goalTargetDate = `${form.goalYear}-${String(MONTHS.indexOf(form.goalMonth) + 1).padStart(2, "0")}-01`;
        await apiFetch("/goals/upsert-from-pathway", { method: "POST", body: JSON.stringify({ title: form.goalTitle || GOAL_OPTIONS.find(g => g.type === form.goalType)?.name, goalType: form.goalType, targetAmount: String(form.goalTarget), targetDate: goalTargetDate, currency: form.currency }) })
          .then(() => track("goal_created", { goalType: form.goalType, currency: form.currency }))
          .catch(() => {});
        setShowReward(2);
      } else if (s === 5) {
        await saveStep.mutateAsync({ stepNumber: 5, formData: { savings: form.savings, investments: form.investments, debts: form.debts, savingsRatePercent: form.savingsRatePercent, investmentRatePercent: form.investmentRatePercent }, status: "completed" });
        track("onboarding_step_completed", { step: 5, stepName: STEP_NAMES[5] });
        if (form.savings > 0) await apiFetch("/assets/upsert-by-name", { method: "POST", body: JSON.stringify({ name: "Cash & Savings", category: "savings", valueUsd: String(form.savings), currencyOriginal: form.currency }) }).catch(() => {});
        if (form.investments > 0) await apiFetch("/assets/upsert-by-name", { method: "POST", body: JSON.stringify({ name: "Investments", category: "investment", valueUsd: String(form.investments), currencyOriginal: form.currency }) }).catch(() => {});
        if (form.debts > 0) await apiFetch("/liabilities/upsert-by-name", { method: "POST", body: JSON.stringify({ name: "Total Debts", category: "loan", balanceUsd: String(form.debts), currencyOriginal: form.currency }) }).catch(() => {});
        // Save rates to profile AND localStorage so all pages get correct values
        update.mutate({
          totalSavings: String(form.savings) as any,
          totalInvestments: String(form.investments) as any,
          savingsRatePercent: String(form.savingsRatePercent) as any,
          investmentRatePercent: String(form.investmentRatePercent) as any,
        } as any);
        saveRatesToStorage(form.savingsRatePercent, form.investmentRatePercent);
        advance(5);
      } else if (s === 6) {
        const rp = getRiskProfile(form.riskAnswers);
        await saveStep.mutateAsync({ stepNumber: 6, formData: { riskProfile: rp }, status: "completed" });
        track("onboarding_step_completed", { step: 6, stepName: STEP_NAMES[6] });
        await apiFetch("/health-score", { method: "POST" })
          .then((data: any) => {
            track("health_score_calculated", { score: data?.overallScore });
            if (typeof data?.overallScore === "number") setHealthScore(Math.round(data.overallScore));
          })
          .catch(() => {});
        update.mutate({ riskProfile: RISK_PROFILE_STORED_VALUE[rp], onboardingComplete: true } as any);
        confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 }, angle: 60 }), 300);
        setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 }, angle: 120 }), 400);
        setShowCompletion(true);
      }
    } catch {
      setStepError("Failed to save. Please try again.");
    }
  }

  const income = form.income;
  const totalExpenses = EXPENSE_CATS.reduce((s, c) => s + form[c.key], 0);
  const savingsRate = income > 0 ? ((income - totalExpenses) / income) * 100 : 0;

  const riskScore = form.riskAnswers.reduce<number>((s, a) => s + (a ?? 0), 0);
  const riskProfile = getRiskProfile(form.riskAnswers);
  const allAnswered = form.riskAnswers.every(a => a !== null);

  // Live preview of monthly returns from Step 5 inputs
  const monthlyReturnsPreview = useMemo(() => {
    return (form.savings * form.savingsRatePercent / 100 / 12) + (form.investments * form.investmentRatePercent / 100 / 12);
  }, [form.savings, form.investments, form.savingsRatePercent, form.investmentRatePercent]);

  const sym = form.currency === "VND" ? "₫" : "$";
  const netWorth = form.savings + form.investments - form.debts;
  const goalYearsAway = parseInt(form.goalYear) - new Date().getFullYear();

  // Sol: one calm observation per step — explains, never directs (SOL_PERSONA.md).
  const solLines = [
    "A few basics first, so the numbers that follow are shaped around you.",
    income > 0
      ? `${sym}${income.toLocaleString()} a month is the number everything else gets measured against.`
      : "Take-home pay is the number everything else gets measured against.",
    income > 0 && totalExpenses > 0
      ? `So far that leaves about ${savingsRate.toFixed(0)}% of your income unspent each month.`
      : "Rough monthly amounts are enough — this is about the shape, not the cents.",
    form.goalType && goalPanel && form.goalTarget > 0 && goalYearsAway > 0
      ? `${sym}${form.goalTarget.toLocaleString()} in ${goalYearsAway} ${goalYearsAway === 1 ? "year" : "years"} gives the rest of your plan a direction.`
      : "One goal is plenty to start. It gives the rest of your plan a direction.",
    "Net worth is simply what you own minus what you owe. Approximate is fine.",
    allAnswered
      ? `Your answers point to a ${riskProfile.toLowerCase()} approach to risk.`
      : "There are no wrong answers — this is about how you feel when markets move.",
  ];

  const STEPS = [
    /* Step 1 */
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-[28px] bg-field p-5 text-forest">
        <Sol size="md" animate="breathe" />
        <h1 className="font-display text-[34px] leading-[1.05] text-balance">Hi, I’m Sol. Tell me a little about you.</h1>
        <p className="text-[13px] font-semibold">Six short steps, about three minutes. You can change any of this later in Settings.</p>
      </section>

      <section aria-label="Age" className="flex items-center justify-between gap-3 rounded-[24px] bg-surface py-4 pl-5 pr-4">
        <div className="flex flex-col gap-1">
          <span className="tala-eyebrow text-ink-40">Age</span>
          <span className="font-display tabular-nums text-[52px] leading-[0.9] tracking-[-0.05em] text-forest" aria-live="polite">{form.age}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Decrease age" onClick={() => setField("age", Math.max(18, form.age - 1))} className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-forest text-forest transition-colors hover:bg-paper">
            <Minus className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Increase age" onClick={() => setField("age", Math.min(80, form.age + 1))} className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-paper transition-opacity hover:opacity-90">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </section>

      <section aria-label="Life stage">
        <h2 className={FIELD_LABEL}>Life stage</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Life stage">
          {LIFE_STAGES.map(s => (
            <button key={s} type="button" role="radio" aria-checked={form.lifeStage === s} onClick={() => setField("lifeStage", s)} className={choiceClass(form.lifeStage === s, PILL)}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Living outside your home country">
        <h2 className={FIELD_LABEL}>Living outside your home country?</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Living outside your home country">
          {[{ label: "Yes, I’m an expat", val: true }, { label: "No", val: false }].map(o => (
            <button key={String(o.val)} type="button" role="radio" aria-checked={form.isExpat === o.val} onClick={() => setField("isExpat", o.val)} className={choiceClass(form.isExpat === o.val, PILL)}>
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Preferred currency">
        <h2 className={FIELD_LABEL}>Preferred currency</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Preferred currency">
          {["USD", "VND"].map(c => (
            <button key={c} type="button" role="radio" aria-checked={form.currency === c} onClick={() => setField("currency", c)} className={choiceClass(form.currency === c, PILL)}>
              {c === "USD" ? "USD $" : "VND ₫"}
            </button>
          ))}
        </div>
      </section>
    </div>,

    /* Step 2 */
    <div className="space-y-7">
      <StepHeading title="How much do you earn?" sub="Your after-tax take-home pay each month — this drives your savings rate. Editable anytime in Budget." />
      <AmountField value={form.income} onChange={v => setField("income", v)} currency={form.currency} label="Monthly take-home pay" />
      <div>
        <p className={FIELD_LABEL}>Income sources</p>
        <div className="flex flex-wrap gap-2">
          {INCOME_TYPES.map(t => {
            const on = form.incomeTypes.includes(t);
            return (
              <button key={t} type="button" aria-pressed={on} onClick={() => setField("incomeTypes", on ? form.incomeTypes.filter(x => x !== t) : [...form.incomeTypes, t])}
                className={choiceClass(on, cn(PILL, "inline-flex items-center gap-1.5"))}>
                {on && <Check className="h-3.5 w-3.5" />}{t}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className={FIELD_LABEL}>Income stability</p>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Income stability">
          {STABILITY.map(s => {
            const on = form.stability === s.label;
            return (
              <button key={s.label} type="button" role="radio" aria-checked={on} onClick={() => setField("stability", s.label)} className={choiceClass(on, "flex flex-col items-center gap-2 rounded-[24px] px-2 py-4 text-[13px] font-semibold")}>
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-[12px] text-forest", on ? "bg-field" : "bg-surface")}><s.icon className="h-5 w-5" /></span>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>,

    /* Step 3 */
    <div className="space-y-3.5">
      <StepHeading title="Where does your money go?" sub="Monthly estimates are fine — tap an amount to type it, and change it anytime in Budget." />
      <div className="flex flex-col rounded-[24px] bg-surface p-1">
        {EXPENSE_CATS.map(cat => {
          const value = form[cat.key];
          const stepBy = form.currency === "VND" ? 500000 : 50;
          const open = expandedCat === cat.key;
          return (
            <div key={cat.key} className="border-b border-hairline last:border-0">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-[12px] text-forest", cat.tile)}><cat.icon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-forest">{cat.label}</span>
                <div className="flex flex-none items-center gap-1">
                  <button type="button" aria-label={`Less ${cat.label.toLowerCase()}`} onClick={() => setField(cat.key, Math.max(0, value - stepBy))} className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-forest text-forest transition-colors hover:bg-paper">
                    <Minus className="h-4 w-4" />
                  </button>
                  <button type="button" aria-expanded={open} aria-label={`${cat.label}: ${value > 0 ? `${sym}${value.toLocaleString()}` : "not set"}. Tap to type an amount`} onClick={() => setExpandedCat(open ? null : cat.key)} className={cn("h-11 min-w-[68px] rounded-full px-1 text-center text-[15px] tabular-nums transition-colors hover:bg-paper", value > 0 ? "font-semibold text-forest" : "font-medium text-ink-30")}>
                    {sym}{compactOrFull(value)}
                  </button>
                  <button type="button" aria-label={`More ${cat.label.toLowerCase()}`} onClick={() => setField(cat.key, value + stepBy)} className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-paper transition-opacity hover:opacity-90">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-3 pb-3">
                      <AmountField value={value} onChange={v => setField(cat.key, v)} currency={form.currency} tone="paper" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      {income > 0 && (
        <section aria-label="Savings rate" className="flex flex-col gap-3 rounded-[28px] bg-forest p-5 text-paper">
          <div className="flex items-center justify-between gap-3">
            <span className="tala-eyebrow text-mint">Left each month</span>
            <span className={cn("rounded-full px-3 py-1.5 text-[12px] font-semibold text-forest tabular-nums", savingsRate >= 10 ? "bg-field" : "bg-sun")}>
              {savingsRate.toFixed(0)}% savings rate
            </span>
          </div>
          <span className="font-display tabular-nums text-[52px] leading-[0.9] tracking-[-0.05em]">
            {income - totalExpenses < 0 ? "−" : ""}{sym}{Math.abs(income - totalExpenses).toLocaleString()}
          </span>
          <span className="text-[13px] text-mint">From {sym}{income.toLocaleString()} income · step 2</span>
        </section>
      )}
    </div>,

    /* Step 4 */
    <div className="space-y-4">
      <StepHeading title="What's your biggest goal?" sub="Pick one — you can add more as a client, and edit this anytime in Goals." />
      <AnimatePresence mode="wait">
        {!goalPanel ? (
          <motion.div key="grid" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Choose a goal">
            {GOAL_OPTIONS.map(g => {
              const on = form.goalType === g.type;
              return (
                <button key={g.type} type="button" role="radio" aria-checked={on} onClick={() => { setField("goalType", g.type); setField("goalTitle", g.name); setGoalPanel(true); }}
                  className={choiceClass(on, "flex min-h-[132px] flex-col items-start rounded-[24px] p-4 text-left")}>
                  <span className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-[12px] text-forest", on ? "bg-field" : "bg-surface")}><g.icon className="h-5 w-5" /></span>
                  <span className="text-[14px] font-semibold leading-tight">{g.name}</span>
                  <span className={cn("mt-1 text-[12px] leading-snug", on ? "text-mint" : "text-ink-40")}>{g.desc}</span>
                </button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div key="detail" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
            <button type="button" onClick={() => setGoalPanel(false)} className="inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-forest px-4 text-[14px] font-semibold text-forest transition-colors hover:bg-surface">
              <ArrowLeft className="h-4 w-4" />Choose a different goal
            </button>
            {(() => {
              const G = GOAL_OPTIONS.find(g => g.type === form.goalType);
              return G ? (
                <div className="flex items-center gap-3 rounded-[24px] bg-surface p-4">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-field text-forest"><G.icon className="h-5 w-5" /></span>
                  <div>
                    <p className="text-[15px] font-semibold text-forest">{G.name}</p>
                    <p className="text-[13px] text-ink-40">{G.desc}</p>
                  </div>
                </div>
              ) : null;
            })()}
            <div>
              <label htmlFor="goal-title" className={FIELD_LABEL}>Goal name</label>
              <input id="goal-title" value={form.goalTitle} onChange={e => setField("goalTitle", e.target.value)} className={INPUT_CLASS} />
            </div>
            <AmountField value={form.goalTarget} onChange={v => setField("goalTarget", v)} currency={form.currency} label="Target amount" />
            <div>
              <p className={FIELD_LABEL}>Target date</p>
              <div className="flex gap-3">
                <SelectField ariaLabel="Target month" value={form.goalMonth} onChange={v => setField("goalMonth", v)} options={MONTHS} />
                <SelectField ariaLabel="Target year" value={form.goalYear} onChange={v => setField("goalYear", v)} options={YEARS} />
              </div>
              <p className="mt-2 px-1 text-[13px] text-ink-40">in {goalYearsAway} {goalYearsAway === 1 ? "year" : "years"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,

    /* Step 5 */
    <div className="space-y-6">
      <StepHeading title="Let's complete your picture" sub="Approximate numbers are totally fine — this shapes your Health Score and net worth. Editable anytime in Net Worth." />

      <div className="rounded-[28px] bg-forest p-5">
        <p className="tala-eyebrow text-mint">Your net worth</p>
        <div className="mt-3 flex items-baseline gap-3 flex-wrap">
          <p className="font-display tabular-nums text-[52px] leading-[0.9] tracking-[-0.05em] text-paper">
            {netWorth < 0 ? "−" : ""}{sym}{Math.abs(netWorth).toLocaleString()}
          </p>
          {netWorth < 0 && <span className="rounded-full bg-sun px-3 py-1.5 text-[12px] font-semibold text-forest">Negative</span>}
        </div>
        {(form.savings + form.investments + form.debts) > 0 && (
          <>
            <div className="mt-4 flex h-2 gap-1 overflow-hidden rounded-full">
              <div className="rounded-full bg-field" style={{ width: `${Math.min(100, ((form.savings + form.investments) / Math.max(form.savings + form.investments, form.debts)) * 100)}%` }} />
              <div className="flex-1 rounded-full bg-track-dark" />
            </div>
            <div className="mt-2 flex justify-between text-[12px] text-mint">
              <span>Own {sym}{(form.savings + form.investments).toLocaleString()}</span>
              <span>Owe {sym}{form.debts.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      <AmountField value={form.savings} onChange={v => setField("savings", v)} currency={form.currency} label="Total current savings" />
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="px-1 font-sans text-[16px] font-semibold text-forest">Investments</span>
          <CheckToggle checked={form.noInvestments} onChange={c => { setField("noInvestments", c); if (c) setField("investments", 0); }} label="I don't have investments yet" />
        </div>
        {!form.noInvestments && <AmountField value={form.investments} onChange={v => setField("investments", v)} currency={form.currency} />}
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="px-1 font-sans text-[16px] font-semibold text-forest">Total debts</span>
          <CheckToggle checked={form.debtFree} onChange={c => { setField("debtFree", c); if (c) setField("debts", 0); }} label="I'm debt-free" />
        </div>
        {!form.debtFree && <AmountField value={form.debts} onChange={v => setField("debts", v)} currency={form.currency} />}
      </div>

      {/* Interest rate inputs */}
      <div className="space-y-4 rounded-[24px] bg-surface p-5">
        <h2 className="font-sans text-[16px] font-semibold text-forest">Your money growth rates</h2>
        <div>
          <label htmlFor="savings-rate" className="mb-2 block text-[13px] text-ink-40">Annual savings interest rate (%)</label>
          <input
            id="savings-rate"
            type="number" step="0.1" min="0" max="20"
            value={form.savingsRatePercent}
            onChange={e => setField("savingsRatePercent", parseFloat(e.target.value) || 0)}
            className={cn(INPUT_CLASS, "bg-paper tabular-nums")}
          />
          <p className="mt-1.5 text-[12px] text-ink-30">e.g. bank deposit rate in Vietnam: 4–5%</p>
        </div>
        <div>
          <label htmlFor="investment-rate" className="mb-2 block text-[13px] text-ink-40">Average annual investment return (%)</label>
          <input
            id="investment-rate"
            type="number" step="0.1" min="0" max="25"
            value={form.investmentRatePercent}
            onChange={e => setField("investmentRatePercent", parseFloat(e.target.value) || 0)}
            className={cn(INPUT_CLASS, "bg-paper tabular-nums")}
          />
          <p className="mt-1.5 text-[12px] text-ink-30">e.g. global equity ETF average: 7–9%</p>
        </div>
        {monthlyReturnsPreview > 0 && (
          <div className="flex items-center gap-3 rounded-[16px] bg-field px-4 py-3">
            <TrendingUp className="h-4 w-4 shrink-0 text-forest" />
            <p className="text-[13px] font-medium leading-snug text-forest">
              Your money will grow approx. <span className="tabular-nums font-semibold">${monthlyReturnsPreview.toFixed(0)}/month</span> from returns alone
            </p>
          </div>
        )}
      </div>
    </div>,

    /* Step 6 */
    <div className="space-y-5">
      <StepHeading title="What kind of investor are you?" sub="5 quick questions · no wrong answers — this shapes the advice you'll get from an advisor." />
      {!allAnswered && (
        <div className="flex items-center gap-1.5" aria-label={`Question ${riskSubStep + 1} of ${RISK_QUESTIONS.length}`}>
          {RISK_QUESTIONS.map((_, i) => (
            <div key={i} className={cn("h-1.5 rounded-full transition-all", i < riskSubStep ? "w-4 bg-forest" : i === riskSubStep ? "w-6 bg-forest/50" : "w-4 bg-breeze")} />
          ))}
          <span className="ml-2 tala-eyebrow text-ink-30">{riskSubStep + 1} / {RISK_QUESTIONS.length}</span>
        </div>
      )}
      <AnimatePresence mode="wait">
        {!allAnswered ? (
          <motion.div key={`q${riskSubStep}`} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-2.5">
            <p className="mb-4 px-1 text-[17px] font-semibold leading-snug text-forest">{RISK_QUESTIONS[riskSubStep]?.q}</p>
            {RISK_QUESTIONS[riskSubStep]?.options.map((opt, i) => {
              const on = form.riskAnswers[riskSubStep] === i + 1;
              return (
                <button key={opt} type="button" role="radio" aria-checked={on} onClick={() => {
                  const answers = [...form.riskAnswers];
                  answers[riskSubStep] = i + 1;
                  setField("riskAnswers", answers as any);
                  setDir(1);
                  if (riskSubStep < RISK_QUESTIONS.length - 1) {
                    setTimeout(() => setRiskSubStep(s => s + 1), 200);
                  } else {
                    setTimeout(() => setRiskAnswered(true), 200);
                  }
                }}
                  className={choiceClass(on, "flex min-h-14 w-full items-center justify-between gap-3 rounded-[24px] px-5 py-3.5 text-left text-[15px] font-semibold")}>
                  {opt}
                  {on && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
            {riskSubStep > 0 && (
              <button type="button" onClick={() => { setDir(-1); setRiskSubStep(s => Math.max(0, s - 1)); }} className="inline-flex min-h-11 items-center gap-1.5 pt-1 text-[14px] font-semibold text-ink-40 hover:text-forest">
                <ArrowLeft className="h-4 w-4" />Previous question
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="rounded-[28px] bg-forest p-5">
              <span className="inline-flex rounded-full bg-field px-3 py-1.5 text-[12px] font-semibold text-forest">Your risk profile</span>
              <p className="mt-4 font-display text-[52px] leading-[0.9] tracking-[-0.045em] text-paper">{riskProfile}</p>
              <p className="mt-3 text-[14px] leading-[1.5] text-mint text-pretty">{RISK_PROFILES[riskProfile]?.desc}</p>
            </div>
            <div className="rounded-[24px] bg-surface p-5">
              <h2 className="mb-4 font-sans text-[16px] font-semibold text-forest">Suggested allocation</h2>
              <div className="space-y-3">
                {[
                  { label: "Equities", pct: RISK_PROFILES[riskProfile]?.eq ?? 0, color: "bg-forest" },
                  { label: "Bonds", pct: RISK_PROFILES[riskProfile]?.bond ?? 0, color: "bg-violet" },
                  { label: "Cash", pct: RISK_PROFILES[riskProfile]?.cash ?? 0, color: "bg-field" },
                ].map(a => (
                  <div key={a.label}>
                    <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-ink-40">{a.label}</span><span className="font-semibold tabular-nums text-forest">{a.pct}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-track"><div className={cn("h-full rounded-full", a.color)} style={{ width: `${a.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
  ];

  // Footer action per step — same enable rules and handlers as the in-step buttons had.
  const footer: { label: string; disabled: boolean; onClick: () => void } = [
    { label: "Continue", disabled: !form.lifeStage || form.isExpat === null, onClick: () => finishStep(1) },
    { label: "Continue", disabled: form.income <= 0, onClick: () => finishStep(2) },
    { label: "Continue", disabled: false, onClick: () => finishStep(3) },
    { label: "Continue", disabled: !form.goalType, onClick: () => finishStep(4) },
    { label: "Continue", disabled: false, onClick: () => finishStep(5) },
    { label: "Complete setup", disabled: !allAnswered, onClick: () => finishStep(6) },
  ][step] ?? { label: "Continue", disabled: true, onClick: () => {} };

  // Completion screen — shown after step 6 is saved
  if (showCompletion) {
    const firstName = (profile?.fullName ?? "").trim().split(/\s+/)[0];
    const goalLabel = form.goalType ? (form.goalTitle || GOAL_OPTIONS.find(g => g.type === form.goalType)?.name || "") : "";
    // Only tiles we have real values for; the 2×2 grid reflows when one is missing.
    const tiles: { label: string; value: string; className: string; text?: boolean }[] = [
      ...(healthScore !== null ? [{ label: "Health score", value: String(healthScore), className: "bg-field" }] : []),
      ...(income > 0 ? [{ label: "Kept monthly", value: `${savingsRate.toFixed(0)}%`, className: "bg-sun" }] : []),
      ...((form.savings + form.investments + form.debts) > 0 ? [{ label: "Net worth", value: compactMoney(netWorth, sym), className: "bg-breeze" }] : []),
      ...(goalLabel ? [{ label: "Goal", value: goalLabel, className: "bg-surface", text: true }] : []),
    ];
    return (
      <div className="h-[100dvh] bg-paper flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto flex flex-col gap-3 px-4 pt-6 pb-5 animate-rise-up">
            <section className="flex flex-col gap-3.5 rounded-[28px] bg-forest px-5 py-6 text-paper">
              <Sol size="md" animate="breathe" showFace />
              <span className="self-start rounded-full bg-field px-3 py-1.5 text-[12px] font-semibold text-forest">Setup complete</span>
              <h1 className="font-display text-[36px] leading-[1.05] text-balance">
                {firstName ? `Your plan is ready, ${firstName}.` : "Your plan is ready."}
              </h1>
              <p className="text-[14px] leading-[1.45] text-mint text-pretty">
                Here’s what I worked out from your answers. Your personalised plan is waiting on your dashboard.
              </p>
            </section>

            {tiles.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {tiles.map(t => (
                  <div key={t.label} className={cn("flex flex-col gap-1.5 rounded-[24px] p-4 text-forest", t.className)}>
                    <span className={cn("tala-eyebrow", t.className === "bg-surface" ? "text-ink-40" : "text-forest")}>{t.label}</span>
                    {t.text
                      ? <span className="text-[15px] font-semibold leading-[1.3] break-words">{t.value}</span>
                      : <span className="font-display tabular-nums text-[40px] leading-none tracking-[-0.05em]">{t.value}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
        <footer className="shrink-0 bg-paper">
          <div className="max-w-lg mx-auto px-4 pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-forest px-5 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90"
              onClick={() => navigate("/free/dashboard")}
            >
              Go to my dashboard <ArrowRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  if (showReward) {
    const messages = {
      1: { title: "Income logged!", desc: "Step 2 complete — let's track your expenses next", nextStep: 2 },
      2: { title: "Goal set!", desc: "Step 4 complete — now let's see your full financial picture", nextStep: 4 },
    } as const;
    const msg = messages[showReward];
    return (
      <RewardReveal
        rewardNumber={showReward}
        title={msg.title}
        description={msg.desc}
        onDismiss={() => {
          setShowReward(null);
          advance(msg.nextStep);
        }}
      />
    );
  }

  // Show a spinner while the query determines where to resume
  if (progressLoading) {
    return (
      <div className="min-h-[100dvh] bg-paper flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-forest border-t-transparent animate-spin" />
      </div>
    );
  }

  const showSolTip = step > 0 && !(step === 2 && income > 0);

  return (
    <div className="h-[100dvh] bg-paper flex flex-col overflow-hidden">
      {/* Top progress */}
      <header className="shrink-0 bg-paper">
        <div className="max-w-lg mx-auto flex flex-col gap-2.5 px-4 pt-4 pb-2">
          <div className="flex min-h-11 items-center justify-between gap-3">
            {step > 0 ? (
              <>
                <button type="button" onClick={back} className="inline-flex h-11 items-center gap-1 rounded-full bg-surface pl-2.5 pr-4 text-[14px] font-semibold text-forest transition-opacity hover:opacity-80">
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />Back
                </button>
                <p className="tala-eyebrow text-ink-40 text-right" aria-live="polite">Step {step + 1} of 6 · {STEP_NAMES[step + 1]}</p>
              </>
            ) : (
              <>
                <p className="tala-eyebrow text-ink-40" aria-live="polite">Step {step + 1} of 6 · {STEP_NAMES[step + 1]}</p>
                <button type="button" onClick={skipStep} className="min-h-11 px-1 text-[14px] font-semibold text-forest underline underline-offset-4 transition-opacity hover:opacity-70">
                  Skip
                </button>
              </>
            )}
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-[3px] transition-colors", i <= step ? "bg-forest" : "bg-breeze")} />
            ))}
          </div>
          <p className="flex items-center justify-end gap-1 text-[12px] text-ink-30 tabular-nums" aria-live="polite">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? <><Check className="h-3.5 w-3.5 text-forest" />Saved</> : `${completedCount}/6 done`}
          </p>
        </div>
      </header>

      {/* Step content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-lg mx-auto px-4 pt-1 pb-5">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              {STEPS[step]}
              {showSolTip && <SolTip line={solLines[step] ?? solLines[0]} />}
            </motion.div>
          </AnimatePresence>

          {/* Save error */}
          {stepError && (
            <div role="alert" className="mt-5 rounded-[16px] bg-sun px-4 py-3 text-center text-[14px] font-semibold text-forest">
              {stepError}
            </div>
          )}

          {/* Skip link — step 1 has it in the header; not shown on the final step */}
          {step > 0 && step < 5 && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={skipStep}
                className="min-h-11 px-2 text-[14px] font-semibold text-forest underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Sticky action */}
      <footer className="shrink-0 bg-paper">
        <div className="max-w-lg mx-auto px-4 pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={footer.disabled}
            onClick={footer.onClick}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-opacity",
              footer.disabled ? "bg-surface text-ink-30 cursor-not-allowed" : "bg-forest text-paper hover:opacity-90",
            )}
          >
            {footer.label}
            {!footer.disabled && <ArrowRight className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </footer>
    </div>
  );
}
