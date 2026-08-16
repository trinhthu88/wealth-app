// ANIMATION RULES FOR THIS PAGE:
// ✓ ALLOWED: BottomSheet spring (RequestReviewSheet)
// ✓ ALLOWED: Comment appearing in thread after submit (opacity 0→1, 200ms)
// ✗ BANNED:  Page-load stagger on milestones
// ✗ BANNED:  Timeline animated draw on load

import { useState } from "react";
import { Link } from "wouter";
import { Map } from "lucide-react";
import ClientAppShell from "@/components/client/AppShell";
import PlanHeader from "@/components/client/plan/PlanHeader";
import ReviewCountdown from "@/components/client/plan/ReviewCountdown";
import PlanProgressRing from "@/components/client/plan/PlanProgressRing";
import PlanTimeline from "@/components/client/plan/PlanTimeline";
import RequestReviewSheet from "@/components/client/plan/RequestReviewSheet";
import { usePlan } from "@/hooks/usePlan";

export default function ClientPlan() {
  const {
    plan, milestones,
    completedCount, inProgressCount, upcomingCount, totalCount, completionPct,
    nextMilestone, daysUntilReview, isReviewOverdue,
    advisorName, advisorId, nextReviewDate,
    loading, statusGroup,
  } = usePlan();

  const [showReviewSheet, setShowReviewSheet] = useState(false);

  if (loading) {
    return (
      <ClientAppShell>
        <div className="max-w-[860px] mx-auto space-y-4">
          <div className="h-10 bg-slate-100 animate-pulse rounded-xl w-48" />
          <div className="h-24 bg-slate-100 animate-pulse rounded-xl" />
          <div className="h-40 bg-slate-100 animate-pulse rounded-xl" />
        </div>
      </ClientAppShell>
    );
  }

  if (!plan) {
    return (
      <ClientAppShell>
        <div className="max-w-[860px] mx-auto">
          <div className="bg-white border border-[#E2E8F0] rounded-xl py-16 px-6 text-center">
            <Map className="h-10 w-10 text-[#1D9E75] mx-auto mb-3" />
            <h2 className="text-base font-semibold text-[#042C53] mb-1">
              Your financial plan hasn't been created yet.
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              Your advisor will create a personalised plan for you.
            </p>
            <Link
              href="/client/messages"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#0F6E56] transition-colors"
            >
              Message your advisor →
            </Link>
          </div>
        </div>
      </ClientAppShell>
    );
  }

  return (
    <ClientAppShell>
      <div className="max-w-[860px] mx-auto space-y-5">
        {/* Header */}
        <PlanHeader advisorName={advisorName} />

        {/* Review countdown */}
        <ReviewCountdown
          nextReviewDate={nextReviewDate}
          daysUntilReview={daysUntilReview}
          isReviewOverdue={isReviewOverdue}
          onRequestReview={() => setShowReviewSheet(true)}
        />

        {/* Progress ring + stats */}
        {totalCount > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <PlanProgressRing
              completedCount={completedCount}
              inProgressCount={inProgressCount}
              upcomingCount={upcomingCount}
              totalCount={totalCount}
              completionPct={completionPct}
            />
          </div>
        )}

        {/* Timeline */}
        {milestones.length > 0 ? (
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-[#042C53] px-1">Milestones</h2>
            <PlanTimeline
              milestones={milestones}
              nextMilestoneId={nextMilestone?.id ?? null}
              statusGroup={statusGroup}
            />
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl py-10 text-center">
            <p className="text-sm text-slate-400">No milestones have been added to your plan yet.</p>
          </div>
        )}
      </div>

      <RequestReviewSheet
        isOpen={showReviewSheet}
        onClose={() => setShowReviewSheet(false)}
        advisorId={advisorId}
        advisorName={advisorName}
        completionPct={completionPct}
        nextMilestoneTitle={nextMilestone?.title ?? null}
      />
    </ClientAppShell>
  );
}
