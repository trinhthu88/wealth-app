import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Map, CalendarDays, AlertTriangle } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import Sol from "@/components/Sol";
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

export default function ClientPlan() {
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

  const coastObservation: SolObservation | null = showCoastCard && cp && coastPoint.retirementGoal
    ? {
        type: "coast_point_acceleration",
        goalTitle: coastPoint.retirementGoal.title,
        extraMonthly: coastPoint.extraMonthly,
        currentCoastDate: cp.base?.coastDate ?? null,
        newCoastDate: cp.accelerated?.coastDate ?? null,
      }
    : null;

  async function handleModelCoastPoint() {
    if (!cp?.available || !coastPoint.retirementGoal) return;
    setModeling(true);
    try {
      const result = runScenario({
        type: "increase_monthly",
        currentValue: totals.totalPortfolioValue,
        currentMonthly: coastPoint.currentMonthly,
        newMonthly: coastPoint.currentMonthly + coastPoint.extraMonthly,
        annualReturnPct: cp.blendedAnnualReturnPct ?? 7,
        months: monthsUntil(coastPoint.retirementGoal.targetDate ?? new Date().toISOString()),
      });
      await saveScenario(result, `Coast point: +$${coastPoint.extraMonthly}/mo`);
      navigate("/client/scenarios");
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
          <Map className="h-10 w-10 text-paper mx-auto mb-3 opacity-90" />
          <h2 className="font-display text-[24px] font-semibold text-paper mb-2">
            Your pathway hasn't been mapped yet
          </h2>
          <p className="text-[14px] text-mint mb-6 max-w-[280px]">
            Your pathway is built from your goals — add one to see it here.
          </p>
          <Link
            href="/client/goals"
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-sun text-sun-ink text-[14px] font-semibold hover:bg-sun/90 transition-colors"
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
          <h1 className="font-display text-[30px] font-semibold text-paper tracking-[-0.02em] mb-1">
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

        {/* Review Countdown */}
        <div className="mb-8 bg-forest-700/50 border border-forest-700 rounded-[22px] p-[18px_20px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-sm relative z-10">
          <div className="flex items-start gap-3">
            {isReviewOverdue ? (
              <div className="w-[34px] h-[34px] rounded-full bg-clay/20 text-clay-tint flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
            ) : (
              <div className="w-[34px] h-[34px] rounded-full bg-[#DCEAE3]/10 text-paper flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4" />
              </div>
            )}
            <div>
              <div className="text-[14px] font-semibold text-paper">Next review</div>
              {nextReviewDate ? (
                <div className={`text-[13px] ${isReviewOverdue ? "text-clay-tint" : "text-mint"}`}>
                  {formatDate(nextReviewDate)} · {isReviewOverdue ? `Overdue by ${Math.abs(daysUntilReview!)} days` : `${daysUntilReview} days away`}
                </div>
              ) : (
                <div className="text-[13px] text-mint opacity-80">No review date set.</div>
              )}
            </div>
          </div>
          <button 
            onClick={() => setShowReviewSheet(true)}
            className="flex-shrink-0 px-5 py-2.5 rounded-full border border-mint-dim text-paper text-[13.5px] font-semibold hover:border-sun hover:text-sun transition-colors"
          >
            Request a review
          </button>
        </div>

        {/* Stats Summary */}
        {totalCount > 0 && (
          <div className="mb-10 space-y-3 relative z-10">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-forest-700/30 rounded-[18px] p-4 text-center border border-forest-700/70">
                <div className="font-display text-[24px] font-semibold text-sun mb-0.5">{completedCount}</div>
                <div className="text-[12px] font-medium tracking-[0.04em] uppercase text-mint">Done</div>
              </div>
              <div className="bg-forest-700/30 rounded-[18px] p-4 text-center border border-forest-700/70">
                <div className="font-display text-[24px] font-semibold text-paper mb-0.5">{inProgressCount}</div>
                <div className="text-[12px] font-medium tracking-[0.04em] uppercase text-mint">Active</div>
              </div>
              <div className="bg-forest-700/30 rounded-[18px] p-4 text-center border border-forest-700/70">
                <div className="font-display text-[24px] font-semibold text-mint-dim mb-0.5">{upcomingCount}</div>
                <div className="text-[12px] font-medium tracking-[0.04em] uppercase text-mint-dim">Upcoming</div>
              </div>
            </div>
            <div className="rounded-full bg-track-dark p-1" aria-label={`${completionPct}% of plan milestones complete`}>
              <div className="h-2 rounded-full bg-sun transition-[width] duration-500" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="relative pl-[34px] pb-6">
          <div className="absolute left-[11px] top-[10px] bottom-[14px] w-[2px] bg-gradient-to-b from-sun from-22% via-track-dark via-40% to-track-dark to-100%" />

          {milestones.map((m, index) => {
              const status = statusGroup(m.status);
              const year = m.targetDate ? new Date(m.targetDate).getFullYear() : "";
              const isNext = m.id === nextMilestone?.id;
              
              if (status === "completed") {
                return (
                  <div key={m.id} className="mb-[28px] relative">
                    <div className="absolute -left-[34px] top-[2px] w-[24px] h-[24px] rounded-full bg-sun flex items-center justify-center text-[12px] text-sun-ink font-bold z-10 shadow-[0_0_12px_rgba(255,182,39,0.3)]">
                      <span className="h-2 w-2 rounded-full bg-sun-ink" aria-hidden="true" />
                    </div>
                    <div className="text-[12.5px] font-semibold tracking-[0.06em] text-sun uppercase">
                      {year} · DONE
                    </div>
                    <h2 className="font-display text-[20px] font-semibold text-paper mt-0.5 mb-1">
                      {m.title}
                    </h2>
                    {m.notes && <div className="text-[13.5px] text-mint max-w-[500px] leading-relaxed">{m.notes}</div>}
                  </div>
                );
              }

              if (status === "in_progress") {
                const gp = m.goalProgress;
                return (
                  <div key={m.id} className={cn("mb-[28px] relative", isNext && "animate-rise-up")}>
                    <div className="absolute -left-[34px] top-[2px] w-[24px] h-[24px] rounded-full bg-forest border-[3px] border-sun z-10 shadow-[0_0_12px_rgba(255,182,39,0.3)]" />
                    <div className="text-[12.5px] font-semibold tracking-[0.06em] text-sun uppercase">
                      {year} · IN PROGRESS {isNext && "· NEXT UP"}
                    </div>
                    <h2 className="font-display text-[20px] font-semibold text-paper mt-0.5 mb-1">
                      {m.title}
                    </h2>
                    {gp ? (
                      <>
                        <div className="text-[13.5px] text-mint mb-2">
                          ${Math.round(gp.currentAmount).toLocaleString()} of ${Math.round(gp.targetAmount).toLocaleString()}
                        </div>
                        <div className="rounded-full bg-track-dark h-[6px] max-w-[420px]" aria-label={`${Math.round(gp.progressPct)}% of ${m.title} funded`}>
                          <div
                            className="h-full rounded-full bg-sun transition-[width] duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, gp.progressPct))}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {m.notes && <div className="text-[13.5px] text-mint mb-2 max-w-[500px] leading-relaxed">{m.notes}</div>}
                        <div className="mt-3 inline-flex rounded-full border border-sun/40 px-3 py-1 text-[12px] font-semibold text-sun">
                          Active milestone
                        </div>
                      </>
                    )}
                  </div>
                );
              }
              
              // Future (upcoming)
              return (
                <div key={m.id} className="mb-[26px] relative">
                  <div className="absolute -left-[34px] top-[2px] w-[24px] h-[24px] rounded-full border-[2px] border-mint-dim z-10 bg-forest" />
                  <div className="text-[12.5px] font-semibold tracking-[0.06em] text-mint-dim uppercase">
                    {year}
                  </div>
                  <h2 className="font-display text-[20px] font-semibold text-[#DCEAE3] mt-0.5 mb-1">
                    {m.title}
                  </h2>
                  {m.notes && <div className="text-[13.5px] text-mint-dim max-w-[500px] leading-relaxed">{m.notes}</div>}
                </div>
              );
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
