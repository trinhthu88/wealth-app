import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CurrencyInput from "@/components/CurrencyInput";
import { ChevronLeft, ChevronRight, Plus, Grip, Check } from "lucide-react";
import { toast } from "sonner";

const STEPS = 6;

const GOAL_TYPES = [
  { id: "retire", label: "Retire comfortably", emoji: "🌴" },
  { id: "property", label: "Buy property", emoji: "🏠" },
  { id: "education", label: "Children's education", emoji: "📚" },
  { id: "fire", label: "Financial independence", emoji: "🚀" },
  { id: "business", label: "Business", emoji: "💼" },
  { id: "emigrate", label: "Emigrate", emoji: "🌍" },
  { id: "wealth", label: "Build wealth", emoji: "💰" },
  { id: "early_retire", label: "Retire early", emoji: "🎓" },
];

const INVESTMENT_STYLES = [
  { id: "rsp", label: "Regular monthly savings", sub: "Great for building a habit, cost-averaging over time", emoji: "💸" },
  { id: "lump_sum", label: "Lump sum", sub: "Put your money to work immediately", emoji: "💼" },
  { id: "combination", label: "Both", sub: "The most powerful combination", emoji: "🔄" },
  { id: "exploring", label: "Still exploring", sub: "Browse illustrations before committing", emoji: "🤔" },
];

const RISK_QUESTIONS = [
  {
    q: "What is your primary investment goal?",
    options: [
      { label: "Preserve capital", score: 1 },
      { label: "Generate stable income", score: 2 },
      { label: "Balance growth and security", score: 3 },
      { label: "Grow wealth significantly", score: 4 },
      { label: "Maximum growth", score: 5 },
    ],
  },
  {
    q: "How long is your investment horizon?",
    options: [
      { label: "Less than 2 years", score: 1 },
      { label: "2–5 years", score: 2 },
      { label: "5–10 years", score: 3 },
      { label: "10–20 years", score: 4 },
      { label: "Over 20 years", score: 5 },
    ],
  },
  {
    q: "If your portfolio dropped 20% in a month, you would:",
    options: [
      { label: "Sell everything immediately", score: 1 },
      { label: "Sell some to reduce risk", score: 2 },
      { label: "Hold and wait it out", score: 3 },
      { label: "Hold and buy a little more", score: 4 },
      { label: "Buy as much as I can", score: 5 },
    ],
  },
  {
    q: "What is your current financial situation?",
    options: [
      { label: "I have little to no savings buffer", score: 1 },
      { label: "I have 1–3 months emergency savings", score: 2 },
      { label: "I have 3–6 months covered", score: 3 },
      { label: "I have 6–12 months covered", score: 4 },
      { label: "Very stable, 12+ months covered", score: 5 },
    ],
  },
  {
    q: "How would you describe your investment experience?",
    options: [
      { label: "No experience at all", score: 1 },
      { label: "Basic knowledge only", score: 2 },
      { label: "Some experience with unit trusts", score: 3 },
      { label: "Experienced with stocks/ETFs", score: 4 },
      { label: "Advanced investor", score: 5 },
    ],
  },
];

function getRiskProfile(score: number) {
  if (score <= 10) return { name: "Conservative", desc: "Capital preservation above all else. Low-volatility assets designed to protect your wealth.", allocation: { equity: 20, bond: 60, cash: 20 } };
  if (score <= 15) return { name: "Moderately Conservative", desc: "Growth with significant protection. A stable base with modest equity exposure.", allocation: { equity: 35, bond: 50, cash: 15 } };
  if (score <= 20) return { name: "Moderate", desc: "Balanced growth and security. Equal weighting to grow and protect your money.", allocation: { equity: 55, bond: 35, cash: 10 } };
  if (score <= 24) return { name: "Moderately Aggressive", desc: "Growth-focused with manageable risk. Higher equity for long-term gains.", allocation: { equity: 75, bond: 20, cash: 5 } };
  return { name: "Aggressive", desc: "Maximum long-term growth. Predominantly equity, accepting short-term volatility.", allocation: { equity: 90, bond: 8, cash: 2 } };
}

const SAVINGS_RANGES = [
  "Less than $10k",
  "$10k–$50k",
  "$50k–$100k",
  "$100k–$500k",
  "Over $500k",
];

interface GoalDraft {
  id: string;
  type: string;
  emoji: string;
  name: string;
  targetAmount: number;
  targetDate: string;
}

interface AdvisorProfile {
  fullName: string;
}

export default function ProspectOnboarding() {
  const [, navigate] = useLocation();
  const { profile } = useProfile();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step 1 state
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [age, setAge] = useState<number>(30);
  const [nationality, setNationality] = useState("");
  const [residence, setResidence] = useState("");
  const [isExpat, setIsExpat] = useState<boolean | null>(null);
  const [currency, setCurrency] = useState<"USD" | "VND">("USD");

  // Step 2 state
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [savingsRange, setSavingsRange] = useState("");
  const [hasInvestments, setHasInvestments] = useState(false);
  const [investValue, setInvestValue] = useState<number>(0);
  const [hasDebts, setHasDebts] = useState(false);
  const [debtValue, setDebtValue] = useState<number>(0);

  // Step 3 state
  const [goals, setGoals] = useState<GoalDraft[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalDraft, setGoalDraft] = useState<Partial<GoalDraft>>({});

  // Step 4 state
  const [riskAnswers, setRiskAnswers] = useState<number[]>([]);
  const [riskQ, setRiskQ] = useState(0);
  const [riskResult, setRiskResult] = useState<ReturnType<typeof getRiskProfile> | null>(null);

  // Step 5 state
  const [investmentStyle, setInvestmentStyle] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState<number>(0);
  const [lumpSumAmount, setLumpSumAmount] = useState<number>(0);

  // Step 6 state
  const [preCallNotes, setPreCallNotes] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  const { data: clientProfile } = useQuery<any>({
    queryKey: ["client-profile-me"],
    queryFn: () => apiFetch("/client-profile/me"),
  });

  const saveProfileMut = useMutation({
    mutationFn: (data: any) => apiFetch("/client-profile/me", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-profile-me"] }),
  });

  const saveSnapshotMut = useMutation({
    mutationFn: (data: any) => apiFetch("/client-financial-snapshot", { method: "POST", body: JSON.stringify(data) }),
  });

  const saveGoalMut = useMutation({
    mutationFn: (data: any) => apiFetch("/goals", { method: "POST", body: JSON.stringify(data) }),
  });

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS - 1));
  };
  const goPrev = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleStep1Next = () => {
    saveProfileMut.mutate({ onboardingStep: 2 });
    goNext();
  };

  const handleStep2Next = () => {
    saveSnapshotMut.mutate({ monthlyIncome, savingsRange, hasInvestments, investmentsRoughValue: investValue, hasDebts, debtsRoughValue: debtValue });
    saveProfileMut.mutate({ onboardingStep: 3 });
    goNext();
  };

  const handleStep3Next = () => {
    saveProfileMut.mutate({ onboardingStep: 4 });
    goNext();
  };

  const handleRiskAnswer = (score: number) => {
    const next = [...riskAnswers, score];
    setRiskAnswers(next);
    if (next.length < RISK_QUESTIONS.length) {
      setTimeout(() => setRiskQ((q) => q + 1), 300);
    } else {
      const total = next.reduce((a, b) => a + b, 0);
      const profile = getRiskProfile(total);
      setRiskResult(profile);
      saveProfileMut.mutate({ riskProfile: profile.name, riskScore: total, onboardingStep: 5 });
    }
  };

  const handleStep4Next = () => {
    if (!riskResult) return;
    goNext();
  };

  const handleStep5Next = () => {
    const indicativeAmount = investmentStyle === "rsp" ? monthlyAmount : investmentStyle === "lump_sum" ? lumpSumAmount : investmentStyle === "combination" ? monthlyAmount + lumpSumAmount : 0;
    saveProfileMut.mutate({ investmentStyle, indicativeAmount: indicativeAmount > 0 ? indicativeAmount : undefined, onboardingStep: 6 });
    goNext();
  };

  const handleComplete = () => {
    saveProfileMut.mutate({
      preCallNotes,
      preferredContactTime: preferredTime,
      prospectOnboardingComplete: true,
      onboardingStep: 6,
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["client-profile-me"] });
        toast.success("You're all set! Your advisor will reach out within 24 hours.");
        navigate("/client/dashboard");
      },
    });
  };

  const addGoal = () => {
    if (!goalDraft.type || !goalDraft.name || !goalDraft.targetAmount || !goalDraft.targetDate) {
      toast.error("Please fill in all goal fields");
      return;
    }
    const g: GoalDraft = {
      id: crypto.randomUUID(),
      type: goalDraft.type!,
      emoji: GOAL_TYPES.find((t) => t.id === goalDraft.type)?.emoji ?? "💰",
      name: goalDraft.name!,
      targetAmount: goalDraft.targetAmount!,
      targetDate: goalDraft.targetDate!,
    };
    setGoals((prev) => [...prev, g]);
    setGoalDraft({});
    setShowGoalForm(false);
    saveGoalMut.mutate({ title: g.name, goalType: g.type, targetAmount: String(g.targetAmount), targetDate: g.targetDate, priority: goals.length + 1 });
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="p-4 flex items-center gap-3">
        <img src="/logo.svg" className="h-8 w-auto" alt="WealthApp" />
        <div className="text-sm font-medium text-muted-foreground">Investment Setup</div>
      </div>

      <div className="px-4 mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>Step {step + 1} of {STEPS}</span>
          <span>{Math.round(((step + 1) / STEPS) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${((step + 1) / STEPS) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div className="flex-1 px-4 pb-24 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {step === 0 && (
              <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-navy mb-1">About You</h2>
                    <p className="text-sm text-muted-foreground">Let's start with some basics.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Full name</label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="text-lg" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Age</label>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" onClick={() => setAge((a) => Math.max(18, a - 1))}>-</Button>
                      <span className="text-2xl font-bold w-12 text-center">{age}</span>
                      <Button variant="outline" size="icon" onClick={() => setAge((a) => a + 1)}>+</Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Nationality</label>
                    <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. British, Vietnamese, Australian" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Country of residence</label>
                    <Input value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="e.g. Vietnam, Singapore" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Are you an expat?</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          onClick={() => setIsExpat(v)}
                          className={`py-3 rounded-xl border-2 font-semibold text-sm transition-all ${isExpat === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                        >
                          {v ? "YES" : "NO"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preferred currency</label>
                    <div className="flex gap-2">
                      {(["USD", "VND"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setCurrency(c)}
                          className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${currency === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-navy mb-1">Your Financial Picture</h2>
                    <p className="text-sm text-muted-foreground">These ranges help us understand your situation — exact numbers come later.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Monthly take-home income</label>
                    <CurrencyInput value={monthlyIncome} onChange={setMonthlyIncome} currency="USD" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Total savings</label>
                    <div className="flex flex-wrap gap-2">
                      {SAVINGS_RANGES.map((r) => (
                        <button
                          key={r}
                          onClick={() => setSavingsRange(r)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${savingsRange === r ? "border-primary bg-primary text-white" : "border-border text-muted-foreground hover:border-primary/40"}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Do you have investments?</label>
                      <button onClick={() => setHasInvestments(!hasInvestments)} className={`w-11 h-6 rounded-full transition-colors ${hasInvestments ? "bg-primary" : "bg-slate-300"} relative`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${hasInvestments ? "translate-x-5.5 left-0.5" : "left-0.5"}`} />
                      </button>
                    </div>
                    {hasInvestments && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Rough value</label>
                        <CurrencyInput value={investValue} onChange={setInvestValue} currency="USD" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Any significant debts?</label>
                      <button onClick={() => setHasDebts(!hasDebts)} className={`w-11 h-6 rounded-full transition-colors ${hasDebts ? "bg-primary" : "bg-slate-300"} relative`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${hasDebts ? "translate-x-5.5 left-0.5" : "left-0.5"}`} />
                      </button>
                    </div>
                    {hasDebts && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Rough total</label>
                        <CurrencyInput value={debtValue} onChange={setDebtValue} currency="USD" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-navy mb-1">Your Goals</h2>
                    <p className="text-sm text-muted-foreground">Add up to 5 financial goals.</p>
                  </div>

                  {goals.map((g, i) => (
                    <div key={g.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-border">
                      <Grip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="text-lg">{g.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{g.name}</div>
                        <div className="text-xs text-muted-foreground">${g.targetAmount.toLocaleString()} · {g.targetDate}</div>
                      </div>
                      <div className="shrink-0">
                        <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full">Priority {i + 1}</span>
                      </div>
                    </div>
                  ))}

                  {goals.length < 5 && !showGoalForm && (
                    <button onClick={() => setShowGoalForm(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors">
                      <Plus className="h-4 w-4" /> Add a goal
                    </button>
                  )}

                  {showGoalForm && (
                    <div className="border border-border rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        {GOAL_TYPES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setGoalDraft((d) => ({ ...d, type: t.id, name: t.label }))}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${goalDraft.type === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                          >
                            <span className="text-xl">{t.emoji}</span>
                            <span className="text-center leading-tight">{t.label}</span>
                          </button>
                        ))}
                      </div>
                      <Input
                        value={goalDraft.name ?? ""}
                        onChange={(e) => setGoalDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="Goal name"
                      />
                      <CurrencyInput value={goalDraft.targetAmount ?? 0} onChange={(v) => setGoalDraft((d) => ({ ...d, targetAmount: v }))} currency="USD" />
                      <Input
                        type="date"
                        value={goalDraft.targetDate ?? ""}
                        onChange={(e) => setGoalDraft((d) => ({ ...d, targetDate: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowGoalForm(false)} className="flex-1">Cancel</Button>
                        <Button size="sm" onClick={addGoal} className="flex-1">Add goal</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-navy mb-1">Your Risk Profile</h2>
                    <p className="text-sm text-muted-foreground">5 quick questions to understand how you invest.</p>
                  </div>

                  {!riskResult ? (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-3">
                        <span>Question {Math.min(riskQ + 1, 5)} of 5</span>
                        <span>{Math.round(((riskQ) / 5) * 100)}%</span>
                      </div>
                      <div className="h-1 bg-slate-200 rounded-full mb-4">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(riskQ / 5) * 100}%` }} />
                      </div>
                      <p className="font-semibold text-base mb-4">{RISK_QUESTIONS[riskQ]?.q}</p>
                      <div className="space-y-2">
                        {RISK_QUESTIONS[riskQ]?.options.map((opt) => (
                          <button
                            key={opt.label}
                            onClick={() => handleRiskAnswer(opt.score)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 text-sm font-medium transition-all"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-primary mb-1">{riskResult.name}</div>
                        <p className="text-sm text-muted-foreground">{riskResult.desc}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 text-center">Illustrative allocation only — your advisor will personalise this</p>
                        <div className="h-4 rounded-full overflow-hidden flex">
                          <div style={{ width: `${riskResult.allocation.equity}%`, backgroundColor: "#1D9E75" }} className="h-full" />
                          <div style={{ width: `${riskResult.allocation.bond}%`, backgroundColor: "#042C53" }} className="h-full" />
                          <div style={{ width: `${riskResult.allocation.cash}%`, backgroundColor: "#94A3B8" }} className="h-full" />
                        </div>
                        <div className="flex gap-4 mt-2 text-xs justify-center">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#1D9E75" }} /> Equity {riskResult.allocation.equity}%</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#042C53" }} /> Bonds {riskResult.allocation.bond}%</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#94A3B8" }} /> Cash {riskResult.allocation.cash}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-navy mb-1">Investment Style</h2>
                    <p className="text-sm text-muted-foreground">How do you want to invest?</p>
                  </div>
                  <div className="space-y-3">
                    {INVESTMENT_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setInvestmentStyle(style.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${investmentStyle === style.id ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{style.emoji}</span>
                          <div>
                            <div className="font-semibold text-sm">{style.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{style.sub}</div>
                          </div>
                          {investmentStyle === style.id && <Check className="h-5 w-5 text-primary ml-auto shrink-0" />}
                        </div>
                      </button>
                    ))}
                  </div>
                  {investmentStyle && investmentStyle !== "exploring" && (
                    <div className="space-y-3 pt-2">
                      {(investmentStyle === "rsp" || investmentStyle === "combination") && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium">How much per month?</label>
                          <CurrencyInput value={monthlyAmount} onChange={setMonthlyAmount} currency="USD" />
                        </div>
                      )}
                      {(investmentStyle === "lump_sum" || investmentStyle === "combination") && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium">How much to start with?</label>
                          <CurrencyInput value={lumpSumAmount} onChange={setLumpSumAmount} currency="USD" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="max-w-md mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-navy mb-1">Meet Your Advisor</h2>
                    <p className="text-sm text-muted-foreground">Before we set up your investment, your advisor will have a short call to personalise everything.</p>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-border">
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">👤</div>
                    <div>
                      <div className="font-semibold">Your Advisor</div>
                      <div className="text-xs text-muted-foreground">Wealth Advisor · Boutique Advisory</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Specialist in Southeast Asia wealth planning</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Any questions for your call? <span className="text-muted-foreground">(optional)</span></label>
                    <Textarea
                      value={preCallNotes}
                      onChange={(e) => setPreCallNotes(e.target.value)}
                      placeholder="e.g. How are my funds protected? What happens if I need access to my money?"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Best time to reach you</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Morning", "Afternoon", "Evening"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setPreferredTime(t.toLowerCase())}
                          className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${preferredTime === t.toLowerCase() ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">All times in Asia/Ho_Chi_Minh timezone (ICT)</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-border px-4 py-3 flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={goPrev} className="flex-1 max-w-[120px]">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
        {step < STEPS - 1 ? (
          <Button
            onClick={step === 0 ? handleStep1Next : step === 1 ? handleStep2Next : step === 2 ? handleStep3Next : step === 3 ? handleStep4Next : handleStep5Next}
            className="flex-1 ml-auto"
            disabled={step === 3 && !riskResult}
          >
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleComplete} className="flex-1 ml-auto" disabled={saveProfileMut.isPending}>
            {saveProfileMut.isPending ? "Saving…" : "I'm all set →"}
          </Button>
        )}
      </div>
    </div>
  );
}
