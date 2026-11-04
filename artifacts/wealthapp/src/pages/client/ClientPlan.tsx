import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Map, CalendarDays, AlertTriangle } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import Gated from "@/components/client/Gated";
import SolNarration from "@/components/client/SolNarration";
import SolCard from "@/components/client/goals/SolCard";
import RequestReviewSheet from "@/components/client/plan/RequestReviewSheet";
import { usePlan } from "@/hooks/usePlan";
import { useCoastPoint } from "@/hooks/useCoastPoint";
import { useScenarios } from "@/hooks/useScenarios";
import { usePortfolioTotals } from "@/hooks/usePortfolioTotals";
import { generateSolCopy, type SolObservation } from "@/lib/sol";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function monthsUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(12, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
}

function ClientPlanContent() {
  const {
    plan, milestones,
    completedCount, inProgressCount, upcomingCount, totalCount, completionPct,
    nextMilestone, daysUntilReview, isReviewOverdue,
    advisorName, advisorId, nextReviewDate,
    loading, statusGroup,
  } = usePlan();

  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [dismissedCoastCard, setDismissedCoastCard] = useState(false);
  const [modeling, setModeling] = useState(false);
  const [, navigate] = useLocation();

  const coastPoint = useCoastPoint();
  const totals = usePortfolioTotals();
  const { runScenario, saveScenario } = useScenarios();

  const cp = coastPoint.data;
  // Only surface this when the extra amount actually changes the coast date —
  // never render a Sol message with a no-op number.
  const showCoastCard = !!cp?.available && !!cp.base && !!cp.accelerated
    && cp.base.coastDate !== cp.accelerated.coastDate && !dismissedCoastCard;

  const coastObservation: SolObservation | null = showCoastCard && cp && cp.goalTitle
    ? {
        type: "coast_point_acceleration",
        goalTitle: cp.goalTitle,
        extraMonthly: coastPoint.extraMonthly,
        currentCoastDate: cp.base?.coastDate ?? null,
        newCoastDate: cp.accelerated?.coastDate ?? null,
      }
    : null;

  async function handleModelCoastPoint() {
    if (!cp?.available || !cp.goalTargetDate) return;
    setModeling(true);
    try {
      const currentMonthly = cp.monthlyContribution ?? 0;
      const result = runScenario({
        type: "increase_monthly",
        currentValue: totals.totalPortfolioValue,
        currentMonthly,
        newMonthly: currentMonthly + coastPoint.extraMonthly,
        annualReturnPct: cp.blendedAnnualReturnPct ?? 7,
        months: monthsUntil(cp.goalTargetDate),
      });
      await saveScenario(result, `Coast point: +$${coastPoint.extraMonthly}/mo`);
      navigate("/client/goals/what-if");
    } catch {
      toast.error("Couldn't model that scenario. Try again from Scenarios.");
    } finally {
      setModeling(false);
    }
  }

  if (loading) {
    return (
      <ClientAppShell>
        <div className="animate-pulse space-y-6 max-w-[860px] mx-auto">
          <div className="h-[200px] w-[200px] bg-sun opacity-10 rounded-full ml-auto" />
        </div>
      </ClientAppShell>
    );
  }

  if (milestones.length === 0) {
    return (
      <ClientAppShell>
        <div className="relative h-[60vh] flex flex-col items-center justify-center text-center px-4 max-w-[860px] mx-auto">
          <div className="absolute -top-10 -right-[50px] w-[200px] h-[200px] rounded-full bg-sun opacity-[0.14] animate-sol-glow mix-blend-screen pointer-events-none" />
          <div className="w-11 h-11 rounded-[14px] bg-field text-forest flex items-center justify-center mx-auto mb-4">
            <Map className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-display text-[28px] leading-[1.1] text-paper mb-2">
            Your pathway hasn't been mapped yet
          </h2>
          <p className="text-[14px] text-mint mb-6 max-w-[280px]">
            Your pathway is built from your goals — add one to see it here.
          </p>
          <Link
            href="/client/goals/goals"
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-field text-forest text-[14px] font-semibold hover:bg-field/90 transition-colors"
          >
            Add a goal
          </Link>
        </div>
      </ClientAppShell>
    );
  }

  return (
    <ClientAppShell>
      <div className="relative max-w-[860px] mx-auto">
        <div className="absolute -top-10 -right-[50px] w-[200px] h-[200px] rounded-full bg-sun opacity-[0.14] animate-sol-glow mix-blend-screen pointer-events-none" />
        
        {/* Header Section */}
        <div className="mb-6 relative z-10">
          <h1 className="font-display text-[34px] leading-[1.05] text-paper mb-2">
            Your pathway
          </h1>
          <div className="text-[14px] text-mint flex items-center gap-2">
            <span>{milestones.length} milestone{milestones.length !== 1 ? "s" : ""} ahead</span>
            {advisorName && (
              <>
                <span className="opacity-50">·</span>
                <span>Led by {advisorName}</span>
              </>
            )}
          </div>
        </div>

        <SolNarration
          tone="dark"
          className="relative z-10"
          line={`${completionPct}% through your pathway's ${totalCount} milestone${totalCount !== 1 ? "s" : ""}.${nextMilestone ? ` Next up: ${nextMilestone.title}.` : ""}`}
          detail={
            isReviewOverdue
              ? `Your annual review is overdue by ${Math.abs(daysUntilReview ?? 0)} days. Early years of a plan are about consistency, not returns — a review is where ${advisorName ?? "your advisor"} checks the plan still fits.`
              : nextReviewDate
              ? `Your next fixed point is the review on ${formatDate(nextReviewDate)}, ${daysUntilReview} days away. Early years of a plan are about consistency, not returns — the plan is doing exactly what it was set up to do.`
              : undefined
          }
          advisorFirstName={advisorName?.split(" ")[0] ?? null}
        />

        {/* Review Countdown */}
        <div className="mb-6 bg-white/10 rounded-[24px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3">
            {isReviewOverdue ? (
              <div className="w-10 h-10 rounded-[14px] bg-sun text-forest flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-[14px] bg-field text-forest flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4" />
              </div>
            )}
            <div>
              <div className="text-[16px] font-semibold text-paper">Next review</div>
              {nextReviewDate ? (
                <div className={`text-[13.5px] mt-0.5 tabular-nums ${isReviewOverdue ? "text-sun-tint font-semibold" : "text-mint"}`}>
                  {formatDate(nextReviewDate)} · {isReviewOverdue ? `Overdue by ${Math.abs(daysUntilReview!)} days` : `${daysUntilReview} days away`}
                </div>
              ) : (
                <div className="text-[13.5px] mt-0.5 text-mint">No review date set.</div>
              )}
            </div>
          </div>
          <button 
            onClick={() => setShowReviewSheet(true)}
            className="flex-shrink-0 h-11 px-5 rounded-full bg-field text-forest text-[14px] font-semibold hover:bg-field/90 transition-colors"
          >
            Request a review
          </button>
        </div>

        {/* Stats Summary */}
        {totalCount > 0 && (
          <div className="mb-10 space-y-4 relative z-10">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-field text-forest rounded-[24px] p-4">
                <div className="tala-eyebrow mb-3">Done</div>
                <div className="font-display tabular-nums text-[32px] leading-none">{completedCount}</div>
              </div>
              <div className="bg-breeze text-forest rounded-[24px] p-4">
                <div className="tala-eyebrow mb-3">Active</div>
                <div className="font-display tabular-nums text-[32px] leading-none">{inProgressCount}</div>
              </div>
              <div className="bg-white/10 text-paper rounded-[24px] p-4">
                <div className="tala-eyebrow text-mint mb-3">Upcoming</div>
                <div className="font-display tabular-nums text-[32px] leading-none">{upcomingCount}</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden" aria-label={`${completionPct}% of plan milestones complete`}>
              <div className="h-full rounded-full bg-field transition-[width] duration-500" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="relative pl-[34px] pb-6">
          <div className="absolute left-[11px] top-[10px] bottom-[14px] w-[2px] rounded-full bg-white/20" />

          {milestones.map((m, index) => {
              const status = statusGroup(m.status);
              const year = m.targetDate ? new Date(m.targetDate).getFullYear() : "";
              const isNext = m.id === nextMilestone?.id;
              
              if (status === "completed") {
                const gp = m.goalProgress;
                return (
                  <div key={m.id} className="mb-[28px] relative">
                    <div className="absolute -left-[34px] top-[0px] w-[24px] h-[24px] rounded-full bg-field flex items-center justify-center z-10">
                      <span className="h-2 w-2 rounded-full bg-forest" aria-hidden="true" />
                    </div>
                    <div className="tala-eyebrow text-field">
                      {year} · DONE
                    </div>
                    <h2 className="text-[17px] font-semibold text-paper mt-1.5 mb-1">
                      {m.title}
                    </h2>
                    {m.notes && <div className="text-[14px] text-mint mb-2 max-w-[500px] leading-relaxed">{m.notes}</div>}
                    {gp && (
                      <>
                        <div className="text-[14px] text-mint tabular-nums mb-2">
                          ${Math.round(gp.currentAmount).toLocaleString()} of ${Math.round(gp.targetAmount).toLocaleString()}
                        </div>
                        <div className="rounded-full bg-white/20 h-2 max-w-[420px] overflow-hidden" aria-label={`${Math.round(gp.progressPct)}% of ${m.title} funded`}>
                          <div
                            className="h-full rounded-full bg-field transition-[width] duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, gp.progressPct))}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              }

              if (status === "in_progress") {
                const gp = m.goalProgress;
                return (
                  <div key={m.id} className={cn("mb-[28px] relative", isNext && "animate-rise-up")}>
                    <div className="absolute -left-[34px] top-[0px] w-[24px] h-[24px] rounded-full bg-forest border-[3px] border-field z-10 ring-4 ring-field/20" />
                    <div className="tala-eyebrow text-field">
                      {year} · IN PROGRESS {isNext && "· NEXT UP"}
                    </div>
                    <h2 className="text-[17px] font-semibold text-paper mt-1.5 mb-1">
                      {m.title}
                    </h2>
                    {gp ? (
                      <>
                        <div className="text-[14px] text-mint tabular-nums mb-2">
                          ${Math.round(gp.currentAmount).toLocaleString()} of ${Math.round(gp.targetAmount).toLocaleString()}
                        </div>
                        <div className="rounded-full bg-white/20 h-2 max-w-[420px] overflow-hidden" aria-label={`${Math.round(gp.progressPct)}% of ${m.title} funded`}>
                          <div
                            className="h-full rounded-full bg-field transition-[width] duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, gp.progressPct))}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {m.notes && <div className="text-[14px] text-mint mb-2 max-w-[500px] leading-relaxed">{m.notes}</div>}
                        <div className="mt-3 inline-flex rounded-full bg-field px-2.5 py-1 text-[12px] font-semibold text-forest">
                          Active milestone
                        </div>
                      </>
                    )}
                  </div>
                );
              }
              
              // Future (upcoming)
              {
                const gp = m.goalProgress;
                return (
                  <div key={m.id} className="mb-[26px] relative">
                    <div className="absolute -left-[34px] top-[0px] w-[24px] h-[24px] rounded-full border-[2px] border-white/40 z-10 bg-forest" />
                    <div className="tala-eyebrow text-mint">
                      {year}
                    </div>
                    <h2 className="text-[17px] font-semibold text-paper/85 mt-1.5 mb-1">
                      {m.title}
                    </h2>
                    {m.notes && <div className="text-[14px] text-mint mb-2 max-w-[500px] leading-relaxed">{m.notes}</div>}
                    {gp && (
                      <>
                        <div className="text-[14px] text-mint tabular-nums mb-2">
                          ${Math.round(gp.currentAmount).toLocaleString()} of ${Math.round(gp.targetAmount).toLocaleString()}
                        </div>
                        <div className="rounded-full bg-white/20 h-2 max-w-[420px] overflow-hidden" aria-label={`${Math.round(gp.progressPct)}% of ${m.title} funded`}>
                          <div
                            className="h-full rounded-full bg-field transition-[width] duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, gp.progressPct))}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              }
          })}
        </div>

        {coastObservation && (
          <SolCard
            className="mt-6 relative z-10"
            message={generateSolCopy(coastObservation)}
            onAccept={modeling ? undefined : handleModelCoastPoint}
            onDismiss={() => setDismissedCoastCard(true)}
          />
        )}

        <RequestReviewSheet
          isOpen={showReviewSheet}
          onClose={() => setShowReviewSheet(false)}
          advisorId={advisorId}
          advisorName={advisorName}
          completionPct={completionPct}
          nextMilestoneTitle={nextMilestone?.title ?? null}
        />
      </div>
    </ClientAppShell>
  );
}

export default function ClientPlan() {
  return (
    <Gated capability="plan" page>
      <ClientPlanContent />
    </Gated>
  );
}
