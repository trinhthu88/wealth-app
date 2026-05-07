import { useState } from "react";
import PublicNav from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp, Globe, Brain } from "lucide-react";
import { Link } from "wouter";

function CompoundInterestCalc() {
  const [principal, setPrincipal] = useState("10000");
  const [rate, setRate] = useState("8");
  const [years, setYears] = useState("10");
  const [monthly, setMonthly] = useState("500");
  const [result, setResult] = useState<{ total: number; invested: number; gains: number } | null>(null);

  const calculate = () => {
    const p = parseFloat(principal) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseFloat(years) || 0) * 12;
    const m = parseFloat(monthly) || 0;
    const futureValue = p * Math.pow(1 + r, n) + m * ((Math.pow(1 + r, n) - 1) / r);
    const invested = p + m * n;
    setResult({ total: futureValue, invested, gains: futureValue - invested });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Initial Investment ($)</Label><Input value={principal} onChange={e => setPrincipal(e.target.value)} type="number" /></div>
        <div><Label>Annual Rate (%)</Label><Input value={rate} onChange={e => setRate(e.target.value)} type="number" /></div>
        <div><Label>Years</Label><Input value={years} onChange={e => setYears(e.target.value)} type="number" /></div>
        <div><Label>Monthly Contribution ($)</Label><Input value={monthly} onChange={e => setMonthly(e.target.value)} type="number" /></div>
      </div>
      <Button onClick={calculate} className="w-full">Calculate</Button>
      {result && (
        <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Value</span><span className="font-bold text-primary text-lg">${result.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Invested</span><span className="font-semibold">${result.invested.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Investment Gains</span><span className="font-semibold text-green-600">${result.gains.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
        </div>
      )}
    </div>
  );
}

function SavingsGoalCalc() {
  const [goal, setGoal] = useState("50000");
  const [current, setCurrent] = useState("5000");
  const [rate, setRate] = useState("5");
  const [years, setYears] = useState("5");
  const [result, setResult] = useState<{ monthly: number; weekly: number } | null>(null);

  const calculate = () => {
    const g = parseFloat(goal) || 0;
    const c = parseFloat(current) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseFloat(years) || 0) * 12;
    const pv = c * Math.pow(1 + r, n);
    const needed = g - pv;
    const monthly = r > 0 ? needed * r / (Math.pow(1 + r, n) - 1) : needed / n;
    setResult({ monthly: Math.max(0, monthly), weekly: Math.max(0, monthly / 4.33) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Savings Goal ($)</Label><Input value={goal} onChange={e => setGoal(e.target.value)} type="number" /></div>
        <div><Label>Current Savings ($)</Label><Input value={current} onChange={e => setCurrent(e.target.value)} type="number" /></div>
        <div><Label>Annual Return (%)</Label><Input value={rate} onChange={e => setRate(e.target.value)} type="number" /></div>
        <div><Label>Time Frame (Years)</Label><Input value={years} onChange={e => setYears(e.target.value)} type="number" /></div>
      </div>
      <Button onClick={calculate} className="w-full">Calculate</Button>
      {result && (
        <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monthly Savings Needed</span><span className="font-bold text-primary text-lg">${result.monthly.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Weekly Amount</span><span className="font-semibold">${result.weekly.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
        </div>
      )}
    </div>
  );
}

function ExpatCostCalc() {
  const [salary, setSalary] = useState("5000");
  const [city, setCity] = useState("Singapore");
  const [result, setResult] = useState<{ breakdown: Record<string, number>; total: number; savings: number } | null>(null);

  const CITY_MULTIPLIERS: Record<string, Record<string, number>> = {
    Singapore: { Housing: 1800, Food: 600, Transport: 200, Utilities: 150, Healthcare: 200, Entertainment: 300 },
    "Kuala Lumpur": { Housing: 700, Food: 300, Transport: 150, Utilities: 100, Healthcare: 100, Entertainment: 200 },
    Bangkok: { Housing: 800, Food: 350, Transport: 120, Utilities: 80, Healthcare: 120, Entertainment: 200 },
    Jakarta: { Housing: 900, Food: 300, Transport: 100, Utilities: 90, Healthcare: 100, Entertainment: 150 },
    Manila: { Housing: 700, Food: 280, Transport: 100, Utilities: 100, Healthcare: 120, Entertainment: 180 },
  };

  const calculate = () => {
    const s = parseFloat(salary) || 0;
    const breakdown = CITY_MULTIPLIERS[city] ?? CITY_MULTIPLIERS["Singapore"];
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    setResult({ breakdown, total, savings: s - total });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Monthly Salary ($)</Label><Input value={salary} onChange={e => setSalary(e.target.value)} type="number" /></div>
        <div>
          <Label>City</Label>
          <select value={city} onChange={e => setCity(e.target.value)} className="w-full h-9 px-3 border border-input rounded-md text-sm bg-background">
            {Object.keys(CITY_MULTIPLIERS).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <Button onClick={calculate} className="w-full">Calculate</Button>
      {result && (
        <div className="mt-4 space-y-2">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            {Object.entries(result.breakdown).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                <span className="text-muted-foreground">{k}</span><span>${v.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm py-1 mt-1 font-semibold"><span>Total Expenses</span><span>${result.total.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm py-1"><span className={result.savings >= 0 ? "text-green-600" : "text-red-500"}>Monthly Savings</span><span className={result.savings >= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>${result.savings.toLocaleString()}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskQuiz() {
  const questions = [
    { q: "How long until you need this money?", opts: ["< 1 year", "1-3 years", "3-7 years", "7+ years"], scores: [1, 2, 3, 4] },
    { q: "If your portfolio dropped 20%, you would:", opts: ["Sell everything", "Sell some", "Hold", "Buy more"], scores: [1, 2, 3, 4] },
    { q: "Your primary investment goal is:", opts: ["Capital preservation", "Income", "Growth", "Aggressive growth"], scores: [1, 2, 3, 4] },
    { q: "Your investment experience:", opts: ["None", "Some basics", "Experienced", "Professional"], scores: [1, 2, 3, 4] },
  ];
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [result, setResult] = useState<string | null>(null);

  const profiles: Record<string, { label: string; desc: string; allocation: string }> = {
    Conservative: { label: "Conservative", desc: "Focus on capital preservation. Ideal for short-term goals or low risk tolerance.", allocation: "70% bonds / 20% cash / 10% equities" },
    Moderate: { label: "Moderate", desc: "Balanced approach with steady growth and managed risk.", allocation: "40% equities / 40% bonds / 20% alternatives" },
    "Growth-Oriented": { label: "Growth-Oriented", desc: "Higher equity allocation for long-term wealth accumulation.", allocation: "70% equities / 20% bonds / 10% alternatives" },
    Aggressive: { label: "Aggressive", desc: "Maximum growth potential with high tolerance for volatility.", allocation: "90% equities / 10% alternatives" },
  };

  const calculate = () => {
    if (answers.some(a => a === -1)) return;
    const total = answers.reduce((a, b) => a + b, 0);
    const label = total <= 6 ? "Conservative" : total <= 10 ? "Moderate" : total <= 13 ? "Growth-Oriented" : "Aggressive";
    setResult(label);
  };

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => (
        <div key={qi} className="space-y-2">
          <p className="text-sm font-medium">{qi + 1}. {q.q}</p>
          <div className="grid grid-cols-2 gap-2">
            {q.opts.map((opt, oi) => (
              <button key={oi} onClick={() => { const a = [...answers]; a[qi] = q.scores[oi]; setAnswers(a); }}
                className={`text-left px-3 py-2 text-sm rounded-lg border transition-colors ${answers[qi] === q.scores[oi] ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-muted"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={calculate} className="w-full" disabled={answers.some(a => a === -1)}>Get My Risk Profile</Button>
      {result && profiles[result] && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
          <div className="text-primary font-bold text-xl mb-2">{profiles[result].label}</div>
          <p className="text-sm text-muted-foreground mb-3">{profiles[result].desc}</p>
          <div className="text-sm"><span className="font-medium">Suggested Allocation: </span>{profiles[result].allocation}</div>
          <div className="mt-4">
            <Link href="/sign-up"><Button className="w-full">Get a Personalized Plan</Button></Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">Free Financial Tools</h1>
          <p className="text-muted-foreground">Professional-grade calculators to guide your financial decisions — no sign-up required.</p>
        </div>
        <Tabs defaultValue="compound">
          <TabsList className="grid grid-cols-4 w-full mb-6">
            <TabsTrigger value="compound" className="flex items-center gap-1.5 text-xs"><Calculator className="h-3.5 w-3.5" />Compound</TabsTrigger>
            <TabsTrigger value="savings" className="flex items-center gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Savings</TabsTrigger>
            <TabsTrigger value="expat" className="flex items-center gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" />Expat Cost</TabsTrigger>
            <TabsTrigger value="risk" className="flex items-center gap-1.5 text-xs"><Brain className="h-3.5 w-3.5" />Risk Quiz</TabsTrigger>
          </TabsList>
          <div className="bg-card border border-card-border rounded-xl p-6">
            <TabsContent value="compound"><h2 className="font-semibold mb-4">Compound Interest Calculator</h2><CompoundInterestCalc /></TabsContent>
            <TabsContent value="savings"><h2 className="font-semibold mb-4">Savings Goal Calculator</h2><SavingsGoalCalc /></TabsContent>
            <TabsContent value="expat"><h2 className="font-semibold mb-4">Expat Cost of Living Calculator</h2><ExpatCostCalc /></TabsContent>
            <TabsContent value="risk"><h2 className="font-semibold mb-4">Investment Risk Quiz</h2><RiskQuiz /></TabsContent>
          </div>
        </Tabs>

        <div className="mt-10 bg-gradient-to-br from-[#042C53] to-[#0a4a7a] rounded-xl p-6 text-white text-center">
          <h3 className="font-bold text-lg mb-2">Want a Full Financial Plan?</h3>
          <p className="text-white/70 text-sm mb-4">Sign up free and get your personalized financial pathway, health score, and budgeting tools.</p>
          <Link href="/sign-up"><Button className="bg-[#1D9E75] hover:bg-[#178a65] border-0">Get Started Free</Button></Link>
        </div>
      </div>
    </div>
  );
}
