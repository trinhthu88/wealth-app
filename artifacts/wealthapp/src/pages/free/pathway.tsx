// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Progress bar fill transition
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#F1F4FE, #F1F4FE, #8F98C8)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✓ This is the dark Cobalt "long view" screen: the shell paints bg-forest behind it
// ✗ BANNED:  Page-level nav — the shell's menu bar and section tabs are the ONLY nav
// ✗ BANNED:  The onboarding wizard itself — that lives at /free/onboarding

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { track } from "@/lib/analytics";
import { useState } from "react";
import Sol from "@/components/Sol";
import BottomSheet from "@/components/client/BottomSheet";
import PlanPicker from "@/components/PlanPicker";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Check, PencilLine } from "lucide-react";

interface Step { stepNumber: number; stepName: string; status: string; formData: Record<string, unknown>; }

export default function PathwayPage() {
  const { profile } = useProfile();
  const [plansOpen, setPlansOpen] = useState(false);

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
          <div className="h-8 w-8 rounded-full border-2 border-field border-t-transparent animate-spin" />
        </div>
      </AppShell>
    );
  }

  const steps = [1, 2, 3, 4, 5, 6].map(n => ({
    n,
    done: progress.find(s => s.stepNumber === n)?.status === "completed",
  }));

  // Setup not finished yet: point back to the standalone onboarding flow instead
  // of re-running the wizard inline here.
  if (!allDone) {
    return (
      <AppShell>
        <div className="space-y-5 pb-8">
          <div className="flex items-start gap-3 px-1">
            <div className="shrink-0 mt-0.5"><Sol size="sm" animate="breathe" /></div>
            <div className="pt-0.5 min-w-0">
              <div className="tala-eyebrow text-mint">Sol</div>
              <p className="text-[16px] font-medium leading-[1.4] text-paper mt-1 text-pretty">
                {completedCount === 0
                  ? "Six short steps and I can show you the whole picture."
                  : `${6 - completedCount} ${6 - completedCount === 1 ? "step" : "steps"} left before your pathway is complete.`}
              </p>
            </div>
          </div>

          <div>
            <h1 className="font-display text-[30px] leading-[1.1] text-paper">Your pathway</h1>
            <p className="text-[14px] text-mint mt-1.5">The long view of your money, one step at a time.</p>
          </div>

          <div className="rounded-[28px] bg-forest-700 p-6">
            <div className="tala-eyebrow text-mint">Setup progress</div>
            <div className="font-display tabular-nums text-[56px] leading-none tracking-[-0.04em] text-paper mt-3">
              {completedCount}<span className="text-[24px] text-mint"> / 6</span>
            </div>
            <div className="flex gap-1.5 mt-5" aria-hidden="true">
              {steps.map(st => (
                <div key={st.n} className={cn("h-2 flex-1 rounded-full", st.done ? "bg-field" : "bg-track-dark")} />
              ))}
            </div>
            <p className="text-[14px] text-mint leading-[1.5] mt-4 text-pretty">
              Finish setup to unlock your Health score, budget insights and personalised goals.
            </p>
            <Link
              href="/free/onboarding"
              className="mt-5 inline-flex h-11 w-full items-center justify-between rounded-full bg-field pl-5 pr-1.5 text-[14px] font-semibold text-forest transition-opacity hover:opacity-90"
            >
              {completedCount === 0 ? "Start your pathway" : "Continue setup"}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-paper">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
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
      <div className="space-y-5 pb-8">
        <div className="flex items-start gap-3 px-1">
          <div className="shrink-0 mt-0.5"><Sol size="sm" animate="breathe" /></div>
          <div className="pt-0.5 min-w-0">
            <div className="tala-eyebrow text-mint">Sol</div>
            <p className="text-[16px] font-medium leading-[1.4] text-paper mt-1 text-pretty">
              {income > 0
                ? `You keep ${srPct}% of what you earn. That number shapes every step below.`
                : "Your pathway is complete. Tap any step to update it as life changes."}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[30px] leading-[1.1] text-paper">Your pathway</h1>
            <p className="text-[14px] text-mint mt-1.5">Tap any step to update your answers.</p>
          </div>
          <span className="mb-1 inline-flex flex-none items-center gap-1 rounded-full bg-field px-2.5 py-1 text-[12px] font-semibold text-forest">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />Complete
          </span>
        </div>

        <ol className="relative space-y-2.5">
          <span className="absolute left-[19px] top-5 bottom-5 w-px bg-track-dark" aria-hidden="true" />
          {recap.map(item => (
            <li key={item.step} className="relative">
              <Link
                href={`/free/onboarding?step=${item.step}`}
                className="flex items-center gap-3.5 rounded-[22px] bg-forest-700 py-3.5 pl-0 pr-3 transition-colors hover:bg-forest-700/80"
              >
                <span className="relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-field text-[13px] font-semibold text-forest">
                  {item.step}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="tala-eyebrow block text-mint">{item.label}</span>
                  <span className="mt-1 block text-[15px] font-semibold leading-snug text-paper text-pretty">{item.value}</span>
                </span>
                <PencilLine className="h-4 w-4 flex-none text-mint" aria-label="Edit" />
              </Link>
            </li>
          ))}
        </ol>

        {profile?.role === "free_user" && (
          <div className="rounded-[24px] bg-field p-5">
            <div className="flex items-start gap-3">
              <Sol size="sm" animate="none" />
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-forest">Want a deeper plan?</h3>
                <p className="mt-1 text-[14px] leading-[1.5] text-forest text-pretty">
                  An advisor can turn this pathway into a full plan, with a managed portfolio and what-if scenarios.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { track("upgrade_cta_clicked", { location: "pathway_recap" }); setPlansOpen(true); }}
              className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
            >
              Talk to an advisor
            </button>
          </div>
        )}
      </div>

      <BottomSheet isOpen={plansOpen} onClose={() => setPlansOpen(false)} title="Choose your plan">
        <PlanPicker />
      </BottomSheet>
    </AppShell>
  );
}
