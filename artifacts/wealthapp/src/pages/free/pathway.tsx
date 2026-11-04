// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: Progress bar fill transition
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✓ This is a LIGHT screen (bg-paper) with one Cobalt progress hero
// ✗ BANNED:  Page-level nav — the shell's menu bar and section tabs are the ONLY nav
// ✗ BANNED:  The onboarding wizard itself — that lives at /free/onboarding

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Check } from "lucide-react";

interface Step { stepNumber: number; stepName: string; status: string; formData: Record<string, unknown>; }

const STEP_LABELS: Record<number, string> = {
  1: "About you", 2: "Income", 3: "Expenses", 4: "Goal", 5: "Net worth", 6: "Risk profile",
};

export default function PathwayPage() {
  const { profile } = useProfile();

  const { data: progress = [], isLoading } = useQuery<Step[]>({
    queryKey: ["pathway"],
    queryFn: () => apiFetch<Step[]>("/pathway"),
  });

  const completedCount = progress.filter(s => s.status === "completed").length;
  const allDone = completedCount >= 6;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 rounded-full border-2 border-forest border-t-transparent animate-spin" />
        </div>
      </AppShell>
    );
  }

  const steps = [1, 2, 3, 4, 5, 6].map(n => ({
    n,
    done: progress.find(s => s.stepNumber === n)?.status === "completed",
  }));

  // Recap each answer (only meaningful for completed steps).
  const fd = (n: number) => (progress.find(s => s.stepNumber === n)?.formData ?? {}) as Record<string, unknown>;
  const s1 = fd(1); const s2 = fd(2); const s3 = fd(3); const s4 = fd(4); const s5 = fd(5); const s6 = fd(6);
  const totalExpenses = ["housing", "food", "transport", "utilities", "entertainment", "other"].reduce((sum, k) => sum + Number(s3[k] ?? 0), 0);
  const income = Number(s2.income ?? 0);
  const srPct = income > 0 ? Math.round(((income - totalExpenses) / income) * 100) : 0;

  const recapValue: Record<number, string> = {
    1: `${s1.age ?? "—"} yrs · ${s1.lifeStage ?? "—"} · ${s1.currency ?? "USD"}`,
    2: `${s2.currency === "VND" ? "₫" : "$"}${income.toLocaleString()} a month`,
    3: `${s3.currency === "VND" ? "₫" : "$"}${totalExpenses.toLocaleString()} a month · ${srPct}% kept`,
    4: s4.goalTitle ? `${s4.goalTitle} · $${Number(s4.goalTarget ?? 0).toLocaleString()} by ${s4.goalMonth} ${s4.goalYear}` : "—",
    5: `$${Number(s5.savings ?? 0).toLocaleString()} saved · $${Number(s5.investments ?? 0).toLocaleString()} invested`,
    6: String(s6.riskProfile ?? "—"),
  };

  const heroLine = allDone
    ? (income > 0 ? `You keep ${srPct}% of what you earn. That number shapes every step below.` : null)
    : completedCount === 0
    ? "Six short steps and we can show you the whole picture."
    : `${6 - completedCount} ${6 - completedCount === 1 ? "step" : "steps"} left. Finish setup to unlock your Health score, budget insights and personalised goals.`;

  return (
    <AppShell>
      <div className="flex flex-col gap-3.5 pb-8">

        <section className="flex flex-col gap-1 px-1 pt-1">
          <span className="tala-eyebrow text-ink-40">My pathway</span>
          <h1 className="font-display text-[36px] leading-[1.05] text-forest mt-2">
            {allDone ? "Your plan, step by step" : "Your pathway"}
          </h1>
          <p className="text-[14px] text-ink-40 mt-1">
            {allDone ? "Tap a step to update your answers" : "The long view of your money, one step at a time."}
          </p>
        </section>

        {/* Cobalt progress hero */}
        <section aria-label="Progress" className="bg-forest text-paper rounded-[28px] p-5 flex flex-col gap-3.5">
          <span className="tala-eyebrow text-mint">Setup</span>
          <div className="flex items-end justify-between gap-2">
            <span className="font-display tabular-nums text-[56px] leading-[0.9] tracking-[-0.045em]">
              {completedCount}<span className="text-[26px] text-mint"> of 6</span>
            </span>
            {allDone && (
              <span className="inline-flex items-center gap-1 bg-field text-forest rounded-full px-3 py-1.5 text-[12px] font-semibold">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />Complete
              </span>
            )}
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {steps.map(st => (
              <span key={st.n} className={cn("h-2 flex-1 rounded-full transition-colors", st.done ? "bg-field" : "bg-paper/15")} />
            ))}
          </div>
          {heroLine && <p className="text-[14px] text-mint leading-[1.5] text-pretty">{heroLine}</p>}
          {!allDone && (
            <Link
              href="/free/onboarding"
              className="mt-1 inline-flex h-11 w-full items-center justify-between rounded-full bg-field pl-5 pr-1.5 text-[14px] font-semibold text-forest transition-opacity hover:opacity-90"
            >
              {completedCount === 0 ? "Start your pathway" : "Continue setup"}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-paper">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          )}
        </section>

        {/* Numbered step rows */}
        <ol className="bg-surface rounded-[28px] p-1 flex flex-col">
          {steps.map(st => (
            <li key={st.n} className="border-b border-hairline last:border-0">
              <Link
                href={st.done ? `/free/onboarding?step=${st.n}` : "/free/onboarding"}
                className="flex items-center gap-3 p-3 min-h-11 text-forest rounded-[24px] transition-colors hover:bg-paper/60"
              >
                <span className={cn(
                  "flex h-10 w-10 flex-none items-center justify-center rounded-full text-[14px] font-bold",
                  st.done ? "bg-field text-forest" : "bg-paper text-ink-40",
                )}>
                  {st.n}
                </span>
                <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <span className="tala-eyebrow text-ink-40">{STEP_LABELS[st.n]}</span>
                  <span className={cn("text-[15px] font-semibold leading-snug text-pretty", !st.done && "text-ink-40")}>
                    {st.done ? recapValue[st.n] : "Not done yet"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {profile?.role === "free_user" && (
          <Link
            href="/free/advisor"
            onClick={() => track("upgrade_cta_clicked", { location: "pathway_recap" })}
            className="bg-field rounded-[28px] p-5 flex flex-col gap-2.5 text-forest transition-opacity hover:opacity-95"
          >
            <span className="text-[17px] font-semibold">Want a deeper plan?</span>
            <span className="text-[14px] leading-[1.45] text-pretty">
              An advisor can turn these six answers into a full plan, with a managed portfolio and what-if scenarios.
            </span>
            <span className="self-start mt-1 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper">
              Meet an advisor
            </span>
          </Link>
        )}
      </div>
    </AppShell>
  );
}
