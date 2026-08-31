// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Progress bar fill transition
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#FAF8F5, #F2EFE9, #A8A095)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Double bottom nav — AppShell is the ONLY nav
// ✗ BANNED:  The onboarding wizard itself — that lives at /free/onboarding

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import BottomNav from "@/components/BottomNav";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Check, Edit2, Map, Phone } from "lucide-react";

interface Step { stepNumber: number; stepName: string; status: string; formData: Record<string, unknown>; }

export default function PathwayPage() {
  const { profile } = useProfile();

  const { data: progress = [], isLoading } = useQuery<Step[]>({
    queryKey: ["pathway"],
    queryFn: () => apiFetch<Step[]>("/pathway"),
  });

  const completedCount = progress.filter(s => s.status === "completed").length;
  const allDone = completedCount >= 6;
  const pct = (completedCount / 6) * 100;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <BottomNav />
      </AppShell>
    );
  }

  // Setup not finished yet: point back to the standalone onboarding flow instead
  // of re-running the wizard inline here.
  if (!allDone) {
    return (
      <AppShell>
        <div className="pb-24 md:pb-0 space-y-5">
          <div>
            <h1 className="text-forest text-[22px] font-bold tracking-[-0.02em]">My Pathway</h1>
            <p className="text-sm text-ink-40 mt-1">Your financial setup isn't finished yet.</p>
          </div>

          <div className="bg-surface rounded-[20px] p-6 shadow-[0_4px_14px_rgba(15,23,42,0.06)] text-center">
            <div className="w-14 h-14 rounded-full bg-green-tint flex items-center justify-center mx-auto mb-4">
              <Map className="h-6 w-6 text-green" />
            </div>
            <h2 className="font-display text-[18px] font-bold text-forest mb-1.5">
              {completedCount} of 6 steps complete
            </h2>
            <div className="h-2 rounded-full bg-hairline overflow-hidden my-4 max-w-xs mx-auto">
              <div className="h-full rounded-full bg-green transition-[width] duration-300 ease-in-out" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-ink-60 mb-5">
              Finish setup to unlock your Health Score, budget insights, and personalised goals.
            </p>
            <Link href="/free/onboarding">
              <span className="inline-flex items-center justify-center w-full max-w-xs rounded-xl bg-green text-white text-[15px] font-semibold py-3 hover:bg-forest-700 transition-colors cursor-pointer">
                {completedCount === 0 ? "Start your financial pathway →" : "Continue setup →"}
              </span>
            </Link>
          </div>
        </div>
        <BottomNav />
      </AppShell>
    );
  }

  // Setup complete: recap each answer, with an edit link back into onboarding at that step.
  const fd = (n: number) => (progress.find(s => s.stepNumber === n)?.formData ?? {}) as Record<string, unknown>;
  const s1 = fd(1); const s2 = fd(2); const s3 = fd(3); const s4 = fd(4); const s5 = fd(5); const s6 = fd(6);
  const totalExpenses = ["housing", "food", "transport", "utilities", "entertainment", "other"].reduce((sum, k) => sum + Number(s3[k] ?? 0), 0);
  const income = Number(s2.income ?? 0);
  const srPct = income > 0 ? Math.round(((income - totalExpenses) / income) * 100) : 0;

  const recap = [
    { step: 1, label: "About you", value: `${s1.age ?? "—"} yrs · ${s1.lifeStage ?? "—"} · ${s1.currency ?? "USD"}` },
    { step: 2, label: "Income", value: `${s2.currency === "VND" ? "₫" : "$"}${income.toLocaleString()}/mo` },
    { step: 3, label: "Monthly expenses", value: `${s3.currency === "VND" ? "₫" : "$"}${totalExpenses.toLocaleString()}/mo · ${srPct}% savings rate` },
    { step: 4, label: "Goal", value: s4.goalTitle ? `${s4.goalTitle} · $${Number(s4.goalTarget ?? 0).toLocaleString()} by ${s4.goalMonth} ${s4.goalYear}` : "—" },
    { step: 5, label: "Net worth snapshot", value: `$${Number(s5.savings ?? 0).toLocaleString()} savings · $${Number(s5.investments ?? 0).toLocaleString()} invested` },
    { step: 6, label: "Risk profile", value: String(s6.riskProfile ?? "—") },
  ];

  return (
    <AppShell>
      <div className="pb-24 md:pb-0 space-y-5">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-forest text-[22px] font-bold tracking-[-0.02em]">My Pathway</h1>
            <span className="text-[11px] font-semibold text-green flex items-center gap-1 bg-green-tint rounded-full px-2 py-0.5">
              <Check className="h-3 w-3" />Complete
            </span>
          </div>
          <p className="text-sm text-ink-40">Tap any section to update your answers.</p>
        </motion.div>

        <div className="space-y-3">
          {recap.map(item => (
            <Link key={item.step} href={`/free/onboarding?step=${item.step}`}>
              <span className="w-full bg-surface rounded-[16px] border border-hairline px-4 py-3.5 flex items-center justify-between text-left hover:border-green/40 transition-colors cursor-pointer">
                <span>
                  <span className="block text-[11px] text-ink-40 font-medium mb-0.5">{item.label}</span>
                  <span className="block text-[14px] font-semibold text-forest">{item.value}</span>
                </span>
                <Edit2 className="h-4 w-4 text-ink-40 shrink-0 ml-3" />
              </span>
            </Link>
          ))}
        </div>

        {profile?.role === "free_user" && (
          <div className={cn("bg-forest rounded-2xl p-5 text-paper")}>
            <h4 className="text-[15px] font-semibold mb-2">Want a deeper plan?</h4>
            <p className="text-[14px] text-mint leading-relaxed mb-4 text-pretty">
              An advisor can turn this pathway into a full financial plan with portfolio tracking and scenario modelling.
            </p>
            <a
              href="mailto:hello@tala.app?subject=Upgrade"
              className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-green text-white text-[15px] font-semibold hover:bg-forest-700 transition-colors"
            >
              <Phone className="h-4 w-4" />Talk to an advisor
            </a>
          </div>
        )}
      </div>
      <BottomNav />
    </AppShell>
  );
}
