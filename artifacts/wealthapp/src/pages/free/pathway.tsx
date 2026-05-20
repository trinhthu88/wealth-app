import confetti from "canvas-confetti";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import CurrencyInput from "@/components/CurrencyInput";
import RewardReveal from "@/components/RewardReveal";
import BottomNav from "@/components/BottomNav";
import Sol from "@/components/Sol";
import { ArrowLeft, Check, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveRatesToStorage } from "@/lib/milestones";

interface Step { stepNumber: number; stepName: string; status: string; formData: Record<string, unknown>; }

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
const STABILITY = [{ label: "Very stable", icon: "🏢" }, { label: "Mostly stable", icon: "⚡" }, { label: "Variable", icon: "🌊" }];
const GOAL_OPTIONS = [
  { type: "property", emoji: "🏠", name: "Buy property", desc: "Build your deposit" },
  { type: "retirement", emoji: "🌴", name: "Retire comfortably", desc: "Build enough to stop working" },
  { type: "emergency_fund", emoji: "🛡️", name: "Emergency fund", desc: "3-6 months of expenses" },
  { type: "fi", emoji: "🚀", name: "Financial independence", desc: "Reach your FI number" },
  { type: "debt", emoji: "💳", name: "Pay off debt", desc: "Become debt-free" },
  { type: "other", emoji: "🎯", name: "Other goal", desc: "Something personal" },
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

function getRiskProfile(answers: (number | null)[]) {
  const total = answers.reduce<number>((s, a) => s + (a ?? 0), 0);
  if (total <= 8) return "Conservative";
  if (total <= 12) return "Moderate";
  if (total <= 16) return "Growth";
  return "Aggressive";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() + 1 + i));

const EXPENSE_CATS = [
  { key: "housing" as const, emoji: "🏠", label: "Housing" },
  { key: "food" as const, emoji: "🍜", label: "Food" },
  { key: "transport" as const, emoji: "🚗", label: "Transport" },
  { key: "utilities" as const, emoji: "💡", label: "Utilities" },
  { key: "entertainment" as const, emoji: "🎮", label: "Entertainment" },
  { key: "other" as const, emoji: "📦", label: "Other" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -80, opacity: 0 }),
};

function StepHeading({ step: sn, title, sub }: { step: number; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1D9E75", marginBottom: 8 }}>
        STEP {sn} OF 6
      </p>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 24, fontWeight: 700, color: "#042C53", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: "#6B6459", marginTop: 6 }}>{sub}</p>
    </div>
  );
}

export default function PathwayPage() {
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
  const [alreadyComplete, setAlreadyComplete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepResumed, setStepResumed] = useState(false);
  const [riskSubStep, setRiskSubStep] = useState(0);
  const [riskAnswered, setRiskAnswered] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [goalPanel, setGoalPanel] = useState(false);
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

    // All steps complete → show summary instead of bouncing to dashboard
    if (allDone) {
      setAlreadyComplete(true);
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
        update.mutate({ preferredCurrency: form.currency, isExpat: form.isExpat } as any);
        advance(1);
      } else if (s === 2) {
        await saveStep.mutateAsync({ stepNumber: 2, formData: { income: form.income }, status: "completed" });
        setShowReward(1);
      } else if (s === 3) {
        await saveStep.mutateAsync({ stepNumber: 3, formData: { housing: form.housing, food: form.food, transport: form.transport, utilities: form.utilities, entertainment: form.entertainment, other: form.other }, status: "completed" });
        // Save complete budget entry with income + all expenses so savings rate calculations work
        await apiFetch("/budget", { method: "POST", body: JSON.stringify({
          periodMonth: new Date().toISOString().slice(0, 7),
          currency: form.currency,
          income: String(form.income),
          housing: String(form.housing),
          food: String(form.food),
          transport: String(form.transport),
          utilities: String(form.utilities),
          entertainment: String(form.entertainment),
          other: String(form.other),
        }) }).catch(() => {});
        advance(3);
      } else if (s === 4) {
        await saveStep.mutateAsync({ stepNumber: 4, formData: { goalType: form.goalType, goalTitle: form.goalTitle, goalTarget: form.goalTarget, goalMonth: form.goalMonth, goalYear: form.goalYear }, status: "completed" });
        const goalTargetDate = `${form.goalYear}-${String(MONTHS.indexOf(form.goalMonth) + 1).padStart(2, "0")}-01`;
        await apiFetch("/goals/upsert-from-pathway", { method: "POST", body: JSON.stringify({ title: form.goalTitle || GOAL_OPTIONS.find(g => g.type === form.goalType)?.name, goalType: form.goalType, targetAmount: String(form.goalTarget), targetDate: goalTargetDate, currency: form.currency }) }).catch(() => {});
        setShowReward(2);
      } else if (s === 5) {
        await saveStep.mutateAsync({ stepNumber: 5, formData: { savings: form.savings, investments: form.investments, debts: form.debts, savingsRatePercent: form.savingsRatePercent, investmentRatePercent: form.investmentRatePercent }, status: "completed" });
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
        await apiFetch("/health-score", { method: "POST" }).catch(() => {});
        update.mutate({ riskProfile: rp, onboardingComplete: true } as any);
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

  const STEPS = [
    /* Step 1 */
    <div className="space-y-6">
      <StepHeading step={1} title="Let's get to know you" sub="This helps us personalise everything" />
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground mb-3">Your age</p>
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setField("age", Math.max(18, form.age - 1))} className="h-10 w-10 rounded-full border-2 border-border flex items-center justify-center text-xl font-bold hover:border-primary transition-colors">−</button>
          <span className="text-5xl font-bold text-primary w-16 text-center">{form.age}</span>
          <button onClick={() => setField("age", Math.min(80, form.age + 1))} className="h-10 w-10 rounded-full border-2 border-border flex items-center justify-center text-xl font-bold hover:border-primary transition-colors">+</button>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Life stage</p>
        <div className="flex flex-wrap gap-2">
          {LIFE_STAGES.map(s => (
            <button key={s} onClick={() => setField("lifeStage", s)} className={cn("rounded-full px-4 py-2 text-sm border transition-colors", form.lifeStage === s ? "bg-primary text-white border-primary" : "bg-card border-border text-muted-foreground hover:border-primary")}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Living outside your home country?</p>
        <div className="grid grid-cols-2 gap-3">
          {[{ label: "Yes 🌏", val: true }, { label: "No 🏠", val: false }].map(o => (
            <button key={String(o.val)} onClick={() => setField("isExpat", o.val)} className={cn("rounded-xl border-2 p-4 text-sm font-medium transition-colors", form.isExpat === o.val ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Preferred currency</p>
        <div className="flex rounded-xl border border-border overflow-hidden">
          {["USD", "VND"].map(c => (
            <button key={c} onClick={() => setField("currency", c)} className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", form.currency === c ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted")}>
              {c === "USD" ? "USD ($)" : "VND (₫)"}
            </button>
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!form.lifeStage || form.isExpat === null} onClick={() => finishStep(1)}>Next →</Button>
    </div>,

    /* Step 2 */
    <div className="space-y-6">
      <StepHeading step={2} title="How much do you earn?" sub="Your after-tax take-home pay" />
      <CurrencyInput value={form.income} onChange={v => setField("income", v)} currency={form.currency} />
      <div>
        <p className="text-sm font-medium mb-2">Income sources</p>
        <div className="flex flex-wrap gap-2">
          {INCOME_TYPES.map(t => (
            <button key={t} onClick={() => setField("incomeTypes", form.incomeTypes.includes(t) ? form.incomeTypes.filter(x => x !== t) : [...form.incomeTypes, t])}
              className={cn("rounded-full px-3 py-1.5 text-sm border transition-colors", form.incomeTypes.includes(t) ? "bg-primary/10 text-primary border-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Income stability</p>
        <div className="grid grid-cols-3 gap-2">
          {STABILITY.map(s => (
            <button key={s.label} onClick={() => setField("stability", s.label)} className={cn("rounded-xl border-2 p-3 text-center text-xs font-medium transition-colors", form.stability === s.label ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
              <div className="text-xl mb-1">{s.icon}</div>{s.label}
            </button>
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={form.income <= 0} onClick={() => finishStep(2)}>Next →</Button>
    </div>,

    /* Step 3 */
    <div className="space-y-4">
      <StepHeading step={3} title="Where does your money go?" sub="Tap a category to enter your monthly spend" />
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
        {EXPENSE_CATS.map((cat, i) => (
          <div key={cat.key} className={cn("border-b border-border last:border-0", expandedCat === cat.key && "bg-muted/30")}>
            <button onClick={() => setExpandedCat(expandedCat === cat.key ? null : cat.key)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
              <div className="flex items-center gap-3"><span className="text-xl">{cat.emoji}</span><span className="font-medium text-sm">{cat.label}</span></div>
              <span className={cn("text-sm font-semibold", form[cat.key] > 0 ? "text-primary" : "text-muted-foreground")}>{form[cat.key] > 0 ? `${form.currency === "VND" ? "₫" : "$"}${form[cat.key].toLocaleString()}` : "Tap to enter"}</span>
            </button>
            <AnimatePresence>
              {expandedCat === cat.key && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4">
                    <CurrencyInput value={form[cat.key]} onChange={v => setField(cat.key, v)} currency={form.currency} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      {income > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Savings rate</span>
            <span className={cn("font-semibold", savingsRate > 20 ? "text-primary" : savingsRate > 10 ? "text-amber-500" : "text-red-500")}>
              {savingsRate.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", savingsRate > 20 ? "bg-primary" : savingsRate > 10 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }} />
          </div>
          <p className={cn("text-xs mt-1.5", savingsRate > 20 ? "text-primary" : savingsRate > 10 ? "text-amber-500" : "text-red-500")}>
            {savingsRate > 20 ? "You're on track 🎉" : savingsRate > 10 ? "Getting there" : "Below recommended"}
          </p>
        </div>
      )}
      <Button className="w-full" onClick={() => finishStep(3)}>Next →</Button>
    </div>,

    /* Step 4 */
    <div className="space-y-4">
      <StepHeading step={4} title="What's your biggest goal?" sub="Pick one — you can add more later" />
      <AnimatePresence mode="wait">
        {!goalPanel ? (
          <motion.div key="grid" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="grid grid-cols-2 gap-3">
            {GOAL_OPTIONS.map(g => (
              <button key={g.type} onClick={() => { setField("goalType", g.type); setField("goalTitle", g.name); setGoalPanel(true); }}
                className="rounded-[16px] p-4 text-center transition-colors active:scale-95"
                style={{ border: form.goalType === g.type ? "2px solid #1D9E75" : "2px solid #E6E1D8", background: form.goalType === g.type ? "#E6F5EE" : "white" }}>
                <div className="text-3xl mb-2">{g.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#042C53" }}>{g.name}</div>
                <div style={{ fontSize: 11, color: "#A8A095", marginTop: 2 }}>{g.desc}</div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div key="detail" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
            <button onClick={() => setGoalPanel(false)} className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" />Choose different goal</button>
            <div className="text-center py-2"><span className="text-4xl">{GOAL_OPTIONS.find(g => g.type === form.goalType)?.emoji}</span></div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Goal name</label>
              <input value={form.goalTitle} onChange={e => setField("goalTitle", e.target.value)} className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-card outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <CurrencyInput value={form.goalTarget} onChange={v => setField("goalTarget", v)} currency={form.currency} label="Target amount" />
            <div>
              <label className="text-sm font-medium block mb-1.5">Target date</label>
              <div className="flex gap-2">
                <select value={form.goalMonth} onChange={e => setField("goalMonth", e.target.value)} className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary">
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <select value={form.goalYear} onChange={e => setField("goalYear", e.target.value)} className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary">
                  {YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <p className="text-xs text-muted-foreground mt-1">in {parseInt(form.goalYear) - new Date().getFullYear()} years</p>
            </div>
            <Button className="w-full" disabled={!form.goalType} onClick={() => finishStep(4)}>Next →</Button>
          </motion.div>
        )}
      </AnimatePresence>
      {!goalPanel && <Button className="w-full" disabled={!form.goalType} onClick={() => finishStep(4)}>Next →</Button>}
    </div>,

    /* Step 5 */
    <div className="space-y-5">
      <StepHeading step={5} title="Let's complete your picture" sub="Approximate numbers are totally fine" />
      <CurrencyInput value={form.savings} onChange={v => setField("savings", v)} currency={form.currency} label="💰 Total current savings" />
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">📈 Investments</label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={form.noInvestments} onChange={e => { setField("noInvestments", e.target.checked); if (e.target.checked) setField("investments", 0); }} className="rounded" />
            I don't have investments yet
          </label>
        </div>
        {!form.noInvestments && <CurrencyInput value={form.investments} onChange={v => setField("investments", v)} currency={form.currency} />}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">💸 Total debts</label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={form.debtFree} onChange={e => { setField("debtFree", e.target.checked); if (e.target.checked) setField("debts", 0); }} className="rounded" />
            I'm debt-free
          </label>
        </div>
        {!form.debtFree && <CurrencyInput value={form.debts} onChange={v => setField("debts", v)} currency={form.currency} />}
      </div>

      {/* Interest rate inputs */}
      <div className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
        <p className="text-sm font-medium">💹 Your money growth rates</p>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Annual savings interest rate (%)</label>
          <input
            type="number" step="0.1" min="0" max="20"
            value={form.savingsRatePercent}
            onChange={e => setField("savingsRatePercent", parseFloat(e.target.value) || 0)}
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">e.g. bank deposit rate in Vietnam: 4–5%</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Average annual investment return (%)</label>
          <input
            type="number" step="0.1" min="0" max="25"
            value={form.investmentRatePercent}
            onChange={e => setField("investmentRatePercent", parseFloat(e.target.value) || 0)}
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-card outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">e.g. global equity ETF average: 7–9%</p>
        </div>
        {monthlyReturnsPreview > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 font-medium">
            💰 Your money will grow approx. ${monthlyReturnsPreview.toFixed(0)}/month from returns alone
          </div>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-4">
        <p className="text-xs text-muted-foreground mb-1">Your net worth</p>
        {(() => {
          const nw = form.savings + form.investments - form.debts;
          return (
            <>
              <p className={cn("text-3xl font-bold", nw >= 0 ? "text-primary" : "text-red-500")}>
                {form.currency === "VND" ? "₫" : "$"}{Math.abs(nw).toLocaleString()}{nw < 0 ? " (negative)" : ""}
              </p>
              {(form.savings + form.investments + form.debts) > 0 && (
                <div className="flex gap-1 mt-3 rounded-full overflow-hidden h-2">
                  <div className="bg-primary rounded-full" style={{ width: `${Math.min(100, ((form.savings + form.investments) / Math.max(form.savings + form.investments, form.debts)) * 100)}%` }} />
                  <div className="bg-red-400 rounded-full flex-1" />
                </div>
              )}
            </>
          );
        })()}
      </div>
      <Button className="w-full" onClick={() => finishStep(5)}>Next →</Button>
    </div>,

    /* Step 6 */
    <div className="space-y-4">
      <StepHeading step={6} title="What kind of investor are you?" sub="5 quick questions · no wrong answers" />
      <div className="flex gap-1.5 justify-center">
        {RISK_QUESTIONS.map((_, i) => (
          <div key={i} className={cn("h-1.5 rounded-full transition-all", i < riskSubStep ? "bg-primary" : i === riskSubStep ? "bg-primary/50 w-6" : "bg-muted")} style={{ width: i === riskSubStep ? 24 : 16 }} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        {!allAnswered ? (
          <motion.div key={`q${riskSubStep}`} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-3">
            <p className="font-medium text-base">{RISK_QUESTIONS[riskSubStep]?.q}</p>
            {RISK_QUESTIONS[riskSubStep]?.options.map((opt, i) => (
              <button key={opt} onClick={() => {
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
                className="w-full rounded-[14px] p-3.5 text-left transition-colors active:scale-[0.98]"
                style={{ border: form.riskAnswers[riskSubStep] === i + 1 ? "2px solid #1D9E75" : "2px solid #E6E1D8", background: form.riskAnswers[riskSubStep] === i + 1 ? "#E6F5EE" : "white", fontSize: 14, color: "#042C53" }}>
                {opt}
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-primary mb-1">{riskProfile}</p>
              <p className="text-muted-foreground text-sm">{RISK_PROFILES[riskProfile]?.desc}</p>
            </div>
            <div className="bg-card border border-card-border rounded-2xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Suggested allocation</p>
              <div className="space-y-2">
                {[
                  { label: "Equities", pct: RISK_PROFILES[riskProfile]?.eq ?? 0, color: "bg-primary" },
                  { label: "Bonds", pct: RISK_PROFILES[riskProfile]?.bond ?? 0, color: "bg-blue-400" },
                  { label: "Cash", pct: RISK_PROFILES[riskProfile]?.cash ?? 0, color: "bg-muted" },
                ].map(a => (
                  <div key={a.label}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{a.label}</span><span className="font-medium">{a.pct}%</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className={cn("h-full rounded-full", a.color)} style={{ width: `${a.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={() => finishStep(6)}>Complete setup →</Button>
          </motion.div>
        )}
      </AnimatePresence>
      {!allAnswered && riskSubStep > 0 && (
        <button onClick={() => { setDir(-1); setRiskSubStep(s => Math.max(0, s - 1)); }} className="text-sm text-muted-foreground flex items-center gap-1 mx-auto">
          <ArrowLeft className="h-3.5 w-3.5" />Back
        </button>
      )}
    </div>,
  ];

  // Completion screen — shown after step 6 is saved
  if (showCompletion) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-6" style={{ background: "#042C53" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-sm w-full text-center space-y-6"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 1.2, delay: 0.3 }}
          >
            <Sol size="xl" animate="pulse" showFace />
          </motion.div>

          <div className="space-y-2">
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 26, fontWeight: 700, color: "white", lineHeight: 1.2 }}>
              Your plan is ready.
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 10, lineHeight: 1.6 }}>
              Sol is proud of you. Your financial pathway is complete — your personalised plan awaits.
            </p>
          </div>

          <div className="bg-white rounded-[20px] p-5 space-y-3 text-left">
            {[
              "Profile & goals saved",
              "Risk profile set",
              "Financial snapshot complete",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#1D9E75" }}>
                  <Check className="h-3 w-3 text-white" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#042C53" }}>{item}</span>
              </div>
            ))}
          </div>

          <button
            className="w-full rounded-full transition-opacity active:opacity-80"
            style={{ background: "#1D9E75", color: "white", padding: "17px 24px", fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            onClick={() => navigate("/free/dashboard")}
          >
            Take me to my dashboard →
          </button>
        </motion.div>
      </div>
    );
  }

  if (showReward) {
    const messages = {
      1: { title: "Income logged! 💰", desc: "Step 2 complete — let's track your expenses next", nextStep: 2 },
      2: { title: "Goal set! 🎯", desc: "Step 4 complete — now let's see your full financial picture", nextStep: 4 },
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

  // Already-complete summary: shown when all 6 steps are done and no ?step= param
  if (alreadyComplete && !stepParam) {
    const fd = (n: number) => (progress.find(s => s.stepNumber === n)?.formData ?? {}) as Record<string, unknown>;
    const s1 = fd(1); const s2 = fd(2); const s3 = fd(3); const s4 = fd(4); const s5 = fd(5); const s6 = fd(6);
    const totalExpenses = ["housing","food","transport","utilities","entertainment","other"].reduce((sum, k) => sum + Number(s3[k] ?? 0), 0);
    const income = Number(s2.income ?? 0);
    const srPct = income > 0 ? Math.round(((income - totalExpenses) / income) * 100) : 0;

    return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10" style={{ background: "#FAF8F5", borderBottom: "1px solid #E6E1D8" }}>
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex gap-1.5 flex-1 mr-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 4, flex: 1, borderRadius: 999, background: "#1D9E75" }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: "#1D9E75", fontWeight: 600, whiteSpace: "nowrap" }}>
              <Check className="inline h-3 w-3 mr-1" />All complete
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-4">
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">🎉</div>
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, color: "#042C53" }}>
                Your pathway is complete
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Tap any section to update your answers
              </p>
            </div>

            {[
              {
                step: 1, label: "About you",
                value: `${s1.age ?? "—"} yrs · ${s1.lifeStage ?? "—"} · ${s1.currency ?? "USD"}`,
              },
              {
                step: 2, label: "Income",
                value: `${s2.currency === "VND" ? "₫" : "$"}${Number(s2.income ?? 0).toLocaleString()}/mo`,
              },
              {
                step: 3, label: "Monthly expenses",
                value: `${s3.currency === "VND" ? "₫" : "$"}${totalExpenses.toLocaleString()}/mo · ${srPct}% savings rate`,
              },
              {
                step: 4, label: "Goal",
                value: s4.goalTitle ? `${s4.goalTitle} · $${Number(s4.goalTarget ?? 0).toLocaleString()} by ${s4.goalMonth} ${s4.goalYear}` : "—",
              },
              {
                step: 5, label: "Net worth snapshot",
                value: `$${Number(s5.savings ?? 0).toLocaleString()} savings · $${Number(s5.investments ?? 0).toLocaleString()} invested`,
              },
              {
                step: 6, label: "Risk profile",
                value: String(s6.riskProfile ?? "—"),
              },
            ].map(item => (
              <button
                key={item.step}
                onClick={() => { setAlreadyComplete(false); setStep(item.step - 1); }}
                className="w-full bg-card border border-card-border rounded-xl px-4 py-3.5 flex items-center justify-between text-left hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-0.5">{item.label}</div>
                  <div className="text-sm font-semibold text-foreground">{item.value}</div>
                </div>
                <Edit2 className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-3" />
              </button>
            ))}

            <button
              onClick={() => navigate("/free/dashboard")}
              className="w-full rounded-full mt-2"
              style={{ background: "#1D9E75", color: "white", padding: "15px 24px", fontSize: 15, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Back to dashboard
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Show a spinner while the query determines where to resume
  if (progressLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: "#FAF8F5", borderBottom: "1px solid #E6E1D8" }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {step > 0 && (
            <button onClick={back} style={{ color: "#A8A095", marginRight: 4 }} className="transition-colors hover:opacity-70">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1">
            <div className="flex gap-1.5" style={{ marginBottom: 6 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 4, flex: 1, borderRadius: 999,
                    background: i <= step - 1 ? "#1D9E75" : i === step ? "#1D9E75" : "#E6E1D8",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#A8A095" }}>
              {completedCount}/6 steps complete
            </p>
          </div>
          {saveStatus !== "idle" && (
            <span style={{ fontSize: 11, color: "#A8A095", display: "flex", alignItems: "center", gap: 4 }}>
              {saveStatus === "saving" ? "Saving…" : <><Check className="h-3.5 w-3.5" style={{ color: "#1D9E75" }} />Saved</>}
            </span>
          )}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-lg mx-auto px-4 py-6 pb-28">
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
            </motion.div>
          </AnimatePresence>

          {/* Save error */}
          {stepError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 text-center"
            >
              {stepError}
            </motion.div>
          )}

          {/* Skip link — not shown on the final step */}
          {step < 5 && (
            <div className="mt-5 text-center">
              <button
                onClick={skipStep}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
