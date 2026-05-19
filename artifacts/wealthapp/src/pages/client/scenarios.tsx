import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CurrencyInput from "@/components/CurrencyInput";
import { apiFetch } from "@/lib/api";
import {
  calculateInvestmentGoalProjection,
  scenarioIncreaseMonthly,
  scenarioAddLumpSum,
  scenarioMarketDrop,
  scenarioPauseContributions,
} from "@/lib/investmentGoalProjection";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { TrendingUp, TrendingDown, Clock, Pause, Play, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

interface PackageSummary {
  id: string;
  nickname: string;
  type: string;
  status: string;
  monthlyAmount: string | null;
  lumpSumAmount: string | null;
  expectedAnnualReturn: string;
  latestSnapshot: { totalValueUsd: string; totalInvestedUsd: string } | null;
}

interface ScenarioRow {
  id: string;
  scenarioType: string;
  inputData: any;
  outputData: any;
  isAdvisorPushed: boolean;
  advisorNote: string | null;
  status: string;
  createdAt: string;
}

interface Goal {
  id: string;
  title: string;
  targetAmount: string | null;
  targetDate: string | null;
}

const SCENARIO_TYPES = [
  { id: "increase_monthly", label: "Increase monthly", emoji: "📈", desc: "What if I added more each month?" },
  { id: "lump_sum", label: "Lump sum boost", emoji: "💰", desc: "What if I invested a lump sum today?" },
  { id: "market_drop", label: "Market drop", emoji: "📉", desc: "What if markets fell significantly?" },
  { id: "pause", label: "Pause contributions", emoji: "⏸", desc: "What if I paused for a few months?" },
  { id: "earlier_goal", label: "Reach goal sooner", emoji: "⏰", desc: "What if I want to hit my goal earlier?" },
];

function buildPackageInputs(packages: PackageSummary[]) {
  return packages
    .filter((p) => p.status === "active")
    .map((p) => ({
      currentValueUsd: parseFloat(p.latestSnapshot?.totalValueUsd ?? "0"),
      monthlyContribution: parseFloat(p.monthlyAmount ?? "0"),
      expectedAnnualReturn: parseFloat(p.expectedAnnualReturn),
      type: p.type as any,
    }));
}

function buildProjectionTimeline(
  packages: PackageSummary[],
  extraMonthly = 0,
  extraLumpSum = 0,
  targetAmount: number,
  targetDate: string,
) {
  const inputs = buildPackageInputs(packages).map((p, i) =>
    i === 0
      ? {
          ...p,
          currentValueUsd: p.currentValueUsd + extraLumpSum,
          monthlyContribution: p.monthlyContribution + extraMonthly,
        }
      : p,
  );
  const today = new Date();
  const target = new Date(targetDate);
  const totalMonths = Math.max(
    1,
    (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()),
  );
  const points: { month: number; value: number; invested: number }[] = [];
  for (let m = 0; m <= Math.min(totalMonths, 120); m += Math.ceil(totalMonths / 24)) {
    let totalVal = 0;
    let totalInvested = 0;
    for (const p of inputs) {
      const rate = p.expectedAnnualReturn / 100 / 12;
      const fvBal = p.currentValueUsd * Math.pow(1 + rate, m);
      const fvCon = p.monthlyContribution > 0 && rate > 0
        ? p.monthlyContribution * ((Math.pow(1 + rate, m) - 1) / rate)
        : p.monthlyContribution * m;
      totalVal += fvBal + fvCon;
      totalInvested += extraLumpSum + p.currentValueUsd + p.monthlyContribution * m;
    }
    points.push({ month: m, value: Math.round(totalVal), invested: Math.round(totalInvested) });
  }
  return points;
}

export default function ScenariosPage() {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [extraMonthly, setExtraMonthly] = useState<number>(200);
  const [extraLumpSum, setExtraLumpSum] = useState<number>(5000);
  const [dropPct, setDropPct] = useState<number>(20);
  const [pauseMonths, setPauseMonths] = useState<number>(6);
  const [targetAmount, setTargetAmount] = useState<number>(100000);
  const [targetDate, setTargetDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [result, setResult] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: packages = [] } = useQuery<PackageSummary[]>({
    queryKey: ["my-packages"],
    queryFn: () => apiFetch("/packages"),
  });

  const { data: scenarios = [] } = useQuery<ScenarioRow[]>({
    queryKey: ["scenarios"],
    queryFn: () => apiFetch("/scenarios"),
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => apiFetch("/goals"),
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => apiFetch("/scenarios", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenarios"] });
      toast.success("Scenario saved!");
    },
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/scenarios/${id}`, { method: "PUT", body: JSON.stringify({ status: "dismissed" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios"] }),
  });

  const pkgInputs = buildPackageInputs(packages);

  const runScenario = () => {
    if (!selectedType || pkgInputs.length === 0) {
      if (pkgInputs.length === 0) toast.error("You need active packages to run scenarios.");
      return;
    }
    let res: any;
    if (selectedType === "increase_monthly") res = scenarioIncreaseMonthly(pkgInputs, extraMonthly, targetAmount, targetDate);
    else if (selectedType === "lump_sum") res = scenarioAddLumpSum(pkgInputs, extraLumpSum, targetAmount, targetDate);
    else if (selectedType === "market_drop") res = scenarioMarketDrop(pkgInputs, dropPct, targetAmount, targetDate);
    else if (selectedType === "pause") res = scenarioPauseContributions(pkgInputs, pauseMonths, targetAmount, targetDate);
    else res = calculateInvestmentGoalProjection(targetAmount, targetDate, pkgInputs);
    setResult(res);
  };

  const saveScenario = () => {
    if (!result || !selectedType) return;
    const inputData: any = { targetAmount, targetDate };
    if (selectedType === "increase_monthly") inputData.extraMonthly = extraMonthly;
    if (selectedType === "lump_sum") inputData.extraLumpSum = extraLumpSum;
    if (selectedType === "market_drop") inputData.dropPct = dropPct;
    if (selectedType === "pause") inputData.pauseMonths = pauseMonths;
    saveMut.mutate({ scenarioType: selectedType, inputData, outputData: result });
  };

  const timeline = result && selectedType !== "market_drop" && selectedType !== "pause"
    ? buildProjectionTimeline(
        packages,
        selectedType === "increase_monthly" ? extraMonthly : 0,
        selectedType === "lump_sum" ? extraLumpSum : 0,
        targetAmount,
        targetDate,
      )
    : [];

  const advisorPushed = scenarios.filter((s) => s.isAdvisorPushed && s.status !== "dismissed");
  const mineScenarios = scenarios.filter((s) => !s.isAdvisorPushed);

  return (
    <AppShell>
      <PageHeader title="Scenario Planner" subtitle="Explore how different decisions affect your goals." />

      {advisorPushed.length > 0 && (
        <div className="mb-5 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From your advisor</div>
          {advisorPushed.map((s) => (
            <div key={s.id} className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-primary">{SCENARIO_TYPES.find((t) => t.id === s.scenarioType)?.label ?? s.scenarioType}</span>
                <button onClick={() => dismissMut.mutate(s.id)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              {s.advisorNote && <p className="text-xs text-muted-foreground mb-2">{s.advisorNote}</p>}
              <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="text-xs text-primary flex items-center gap-1">
                {expandedId === s.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expandedId === s.id ? "Hide details" : "View details"}
              </button>
              {expandedId === s.id && (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>Projected value: <span className="font-semibold text-foreground">{fmtCurrency(s.outputData?.totalProjectedValue ?? 0)}</span></div>
                  <div>On track: <span className="font-semibold">{s.outputData?.onTrack ? "Yes" : "No"}</span></div>
                  {s.outputData?.projectedShortfall > 0 && (
                    <div>Shortfall: <span className="font-semibold text-red-500">{fmtCurrency(s.outputData.projectedShortfall)}</span></div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-2xl p-5 mb-5">
        <h3 className="font-semibold mb-4">Run a Scenario</h3>

        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium">Goal target amount</label>
          <CurrencyInput value={targetAmount} onChange={setTargetAmount} currency="USD" />
        </div>
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium">Target date</label>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>

        <div className="text-sm font-medium mb-2">Scenario type</div>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {SCENARIO_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedType(t.id); setResult(null); }}
              className={`text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${selectedType === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
            >
              <span className="text-xl">{t.emoji}</span>
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {selectedType === "increase_monthly" && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Additional monthly amount</label>
            <CurrencyInput value={extraMonthly} onChange={setExtraMonthly} currency="USD" />
          </div>
        )}
        {selectedType === "lump_sum" && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Lump sum to add today</label>
            <CurrencyInput value={extraLumpSum} onChange={setExtraLumpSum} currency="USD" />
          </div>
        )}
        {selectedType === "market_drop" && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Market drop percentage</label>
            <div className="flex gap-2">
              {[10, 20, 30, 40, 50].map((v) => (
                <button key={v} onClick={() => setDropPct(v)} className={`flex-1 py-2 rounded-lg border text-sm font-medium ${dropPct === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{v}%</button>
              ))}
            </div>
          </div>
        )}
        {selectedType === "pause" && (
          <div className="space-y-2 mb-4">
            <label className="text-sm font-medium">Pause for how many months?</label>
            <div className="flex gap-2">
              {[3, 6, 12, 18, 24].map((v) => (
                <button key={v} onClick={() => setPauseMonths(v)} className={`flex-1 py-2 rounded-lg border text-sm font-medium ${pauseMonths === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{v}mo</button>
              ))}
            </div>
          </div>
        )}

        <Button onClick={runScenario} disabled={!selectedType || pkgInputs.length === 0} className="w-full">
          <Play className="h-4 w-4 mr-2" />
          {pkgInputs.length === 0 ? "You need active packages to run scenarios" : "Run scenario"}
        </Button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-card-border rounded-2xl p-5 mb-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Result</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${result.onTrack ? "bg-emerald-100 text-emerald-700" : result.gapPercent <= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
              {result.onTrack ? "On track" : result.gapPercent <= 15 ? "Almost there" : "Off track"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Projected value</div>
              <div className="text-lg font-bold text-primary">{fmtCurrency(result.totalProjectedValue)}</div>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Target</div>
              <div className="text-lg font-bold">{fmtCurrency(targetAmount)}</div>
            </div>
            {result.projectedShortfall > 0 && (
              <div className="bg-red-50 rounded-xl p-3 text-center col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Shortfall</div>
                <div className="text-lg font-bold text-red-600">{fmtCurrency(result.projectedShortfall)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Close it by adding {fmtCurrency(result.additionalMonthlyNeeded)}/month or {fmtCurrency(result.lumpSumNeededToday)} today
                </div>
              </div>
            )}
            {result.recoveryMonths !== undefined && (
              <div className="bg-amber-50 rounded-xl p-3 text-center col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Estimated recovery time</div>
                <div className="text-lg font-bold text-amber-700">{result.recoveryMonths} months</div>
                <div className="text-xs text-muted-foreground">Lost: {fmtCurrency(result.dollarLost)}</div>
              </div>
            )}
            {result.pauseCost !== undefined && (
              <div className="bg-amber-50 rounded-xl p-3 text-center col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Cost of pausing</div>
                <div className="text-lg font-bold text-amber-700">{fmtCurrency(result.pauseCost)}</div>
                <div className="text-xs text-muted-foreground">In missed compounding</div>
              </div>
            )}
          </div>

          {timeline.length > 2 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Projection</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={timeline}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}mo`} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={50} />
                  <Tooltip formatter={(v: any) => fmtCurrency(v)} />
                  <Area type="monotone" dataKey="value" fill="#1D9E7520" stroke="#1D9E75" strokeWidth={2} name="Projected value" />
                  <Area type="monotone" dataKey="invested" fill="#94A3B820" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={0} name="Invested" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={saveScenario} disabled={saveMut.isPending} className="w-full">
            {saveMut.isPending ? "Saving…" : "Save this scenario"}
          </Button>
        </motion.div>
      )}

      {mineScenarios.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved Scenarios</div>
          {mineScenarios.map((s) => (
            <div key={s.id} className="bg-card border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{SCENARIO_TYPES.find((t) => t.id === s.scenarioType)?.label ?? s.scenarioType}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.outputData?.onTrack ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {s.outputData?.onTrack ? "On track" : "Off track"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Projected: {fmtCurrency(s.outputData?.totalProjectedValue ?? 0)} · {new Date(s.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
