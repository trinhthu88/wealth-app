import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/currencyUtils";
import { checkpointCopy } from "@/lib/checkpointCopy";
import { MILESTONES } from "@/lib/milestones";
import type { CheckpointCode } from "@workspace/tier-policy";

interface BudgetSummary { shared: true; months: { month: string; income: string; spending: string; surplus: string; savingsRatePct: string }[] }
interface Score { overallScore: number | null; scoreDate: string }
interface Engagement { streakWeeks: number; lastCheckinAt: string | null; milestones: string[] }
interface FiredCheckpoint { id: string; code: CheckpointCode; firedAt: string; snapshot: Record<string, any>; shownAt: string | null; dismissedAt: string | null; acceptedAt: string | null }

const CARD = "rounded-[26px] border border-hairline bg-surface p-6 shadow-[0_2px_14px_rgba(12,33,164,0.06)]";
const TITLE = "mb-4 font-display text-[18px] font-semibold text-forest";

function checkpointState(c: FiredCheckpoint) {
  if (c.acceptedAt) return "Accepted";
  if (c.dismissedAt) return "Dismissed";
  return c.shownAt ? "Shown" : "Fired";
}

/** What the lead has built and why they're in the pipeline. All read-only. */
export default function LeadActivityPanels({ leadUserId }: { leadUserId: string }) {
  const base = `/advisor/leads/${leadUserId}`;
  const budget = useQuery<BudgetSummary>({
    queryKey: ["lead-budget", leadUserId],
    queryFn: () => apiFetch(`${base}/budget`),
    retry: false,
  });
  const score = useQuery<{ latest: Score | null; history: Score[] }>({
    queryKey: ["lead-score", leadUserId],
    queryFn: () => apiFetch(`${base}/score`),
  });
  const engagement = useQuery<Engagement>({
    queryKey: ["lead-engagement", leadUserId],
    queryFn: () => apiFetch(`${base}/engagement`),
  });
  const checkpoints = useQuery<FiredCheckpoint[]>({
    queryKey: ["lead-checkpoints", leadUserId],
    queryFn: () => apiFetch(`${base}/checkpoints`),
  });
  const earned = engagement.data?.milestones ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className={CARD}>
        <h3 className={TITLE}>Score</h3>
        {score.data?.latest?.overallScore != null ? (
          <p className="text-[14px] text-forest">
            <span className="font-display text-[28px] tabular-nums">{score.data.latest.overallScore}</span>
            <span className="ml-2 text-ink-40">as of {score.data.latest.scoreDate}</span>
          </p>
        ) : <p className="text-[14px] text-ink-40">No score yet.</p>}
      </div>

      <div className={CARD}>
        <h3 className={TITLE}>Engagement</h3>
        <p className="text-[14px] text-forest">
          {engagement.data?.streakWeeks ?? 0} week streak
          {engagement.data?.lastCheckinAt && <span className="text-ink-40"> · last seen {engagement.data.lastCheckinAt.slice(0, 10)}</span>}
        </p>
        <p className="mt-2 text-[13px] text-ink-40">
          {earned.length ? MILESTONES.filter((m) => earned.includes(m.key)).map((m) => m.label).join(" · ") : "No milestones yet."}
        </p>
      </div>

      <div className={CARD}>
        <h3 className={TITLE}>Budget</h3>
        {budget.isError ? (
          <p className="text-[14px] text-ink-40">Not shared. The lead chooses whether to share their budget summary.</p>
        ) : budget.data?.months.length ? (
          <div className="space-y-2">
            {budget.data.months.slice(0, 6).map((m) => (
              <div key={m.month} className="flex justify-between text-[14px]">
                <span className="text-forest">{m.month.slice(0, 7)}</span>
                <span className="tabular-nums text-ink-40">{formatCurrency(parseFloat(m.surplus) || 0, "USD", true)} surplus</span>
              </div>
            ))}
          </div>
        ) : <p className="text-[14px] text-ink-40">No months recorded.</p>}
      </div>

      <div className={CARD}>
        <h3 className={TITLE}>Why they're here</h3>
        {checkpoints.data?.length ? (
          <div className="space-y-3">
            {checkpoints.data.map((c) => (
              <div key={c.id} className="text-[14px]">
                <p className="text-forest">{checkpointCopy(c.code, c.snapshot).body}</p>
                <p className="mt-0.5 text-[12px] text-ink-40">{checkpointState(c)} · {c.firedAt.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-[14px] text-ink-40">Nothing has fired yet.</p>}
      </div>
    </div>
  );
}
