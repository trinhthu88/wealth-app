import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Check, ChevronRight, Eye, EyeOff, LoaderCircle, RotateCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getGetClientSetupChecklistQueryKey,
  useGetClientSetupChecklist,
  useUpdateClientSetupChecklistPreferences,
} from "@workspace/api-client-react";
import type { ClientSetupChecklistItem } from "@workspace/api-client-react";

type Props = { onRiskCheck: () => void };

function SetupItem({ item, onRiskCheck, onStartingFromZero, pending }: {
  item: ClientSetupChecklistItem;
  onRiskCheck: () => void;
  onStartingFromZero: () => void;
  pending: boolean;
}) {
  const content = (
    <>
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-green text-paper" : "border border-green/30 bg-green/5 text-green"}`}>
        {item.done ? <Check className="h-3.5 w-3.5" /> : <ChevronRight className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${item.done ? "text-ink-40" : "text-forest"}`}>{item.title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-40">{item.description}</span>
      </span>
      {!item.done && item.href && <ArrowUpRight className="h-4 w-4 shrink-0 text-green" />}
    </>
  );

  return (
    <div className="rounded-2xl border border-hairline bg-paper/70 p-3.5" data-testid={`checklist-item-${item.id}`}>
      {item.action === "risk_check" ? (
        <button type="button" onClick={onRiskCheck} disabled={item.done} data-testid={`button-checklist-${item.id}`} className="flex w-full items-start gap-3 text-left disabled:cursor-default">
          {content}
        </button>
      ) : item.href && !item.done ? (
        <Link href={item.href} data-testid={`link-checklist-${item.id}`} className="flex items-start gap-3">
          {content}
        </Link>
      ) : (
        <div className="flex items-start gap-3">{content}</div>
      )}
      {item.id === "wealth" && !item.done && (
        <button type="button" onClick={onStartingFromZero} disabled={pending} data-testid="button-starting-from-zero" className="ml-9 mt-2 text-xs font-semibold text-green underline decoration-green/40 underline-offset-4 hover:text-forest disabled:opacity-50">
          I’m starting from zero
        </button>
      )}
    </div>
  );
}

export default function ClientSetupChecklistCard({ onRiskCheck }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetClientSetupChecklist();
  const preferences = useUpdateClientSetupChecklistPreferences();
  const [pendingPreference, setPendingPreference] = useState(false);

  async function savePreference(values: { checklistHidden?: boolean; startingFromZero?: boolean }) {
    setPendingPreference(true);
    try {
      await preferences.mutateAsync({ data: values });
      await queryClient.invalidateQueries({ queryKey: getGetClientSetupChecklistQueryKey() });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your preference could not be saved.");
    } finally {
      setPendingPreference(false);
    }
  }

  if (isLoading) {
    return <div className="space-y-3 rounded-[26px] border border-hairline bg-surface p-5" aria-label="Loading setup checklist" data-testid="checklist-loading"><div className="h-4 w-2/5 animate-pulse rounded bg-hairline" /><div className="h-20 animate-pulse rounded-2xl bg-paper" /><div className="h-16 animate-pulse rounded-2xl bg-paper" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-[26px] border border-hairline bg-surface p-5" data-testid="checklist-error">
        <p className="font-semibold text-forest">Your setup steps are taking a moment.</p>
        <p className="mt-1 text-sm text-ink-40">Try again to load your advisor-guided checklist.</p>
        <button type="button" onClick={() => void refetch()} data-testid="button-retry-checklist" className="mt-3 inline-flex items-center gap-2 rounded-full bg-green px-4 py-2 text-sm font-semibold text-paper"><RotateCw className="h-4 w-4" /> Try again</button>
      </div>
    );
  }

  const allDone = data.items.length > 0 && data.items.every(item => item.done);
  if (data.checklistHidden || allDone) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[22px] border border-hairline bg-surface px-4 py-3" data-testid="checklist-hidden">
        <p className="text-sm text-ink-60">{allDone ? "Your setup checklist is complete." : "Your setup checklist is hidden."}</p>
        {data.checklistHidden && <button type="button" onClick={() => void savePreference({ checklistHidden: false })} disabled={pendingPreference} data-testid="button-show-checklist" className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-green hover:bg-green/5 disabled:opacity-50"><Eye className="h-4 w-4" /> Show again</button>}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[26px] border border-[#D8E6DE] bg-[#EFF6F0] p-4 shadow-[0_2px_14px_rgba(12,33,164,.05)] sm:p-5" data-testid="card-client-setup-checklist">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-green">Your next steps</p>
          <h2 className="mt-1 font-display text-[21px] font-semibold leading-tight tracking-[-0.02em] text-forest">A few things to settle in</h2>
          <p className="mt-1 text-xs text-ink-40">Your advisor is here to help, one step at a time.</p>
        </div>
        <button type="button" onClick={() => void savePreference({ checklistHidden: true })} disabled={pendingPreference} aria-label="Hide setup checklist" data-testid="button-hide-checklist" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-40 hover:bg-paper hover:text-forest disabled:opacity-50"><EyeOff className="h-4 w-4" /></button>
      </header>
      <div className="mt-4 space-y-2.5">
        {data.items.map(item => <SetupItem key={item.id} item={item} onRiskCheck={onRiskCheck} onStartingFromZero={() => void savePreference({ startingFromZero: true })} pending={pendingPreference} />)}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface/70 px-3.5 py-3 text-xs text-ink-60" data-testid="wealth-score-unlock">
        <LoaderCircle className="h-4 w-4 shrink-0 text-green" />
        <span>Wealth score unlocks after 3 months of budget: {data.wealthScoreUnlock.monthsWithBudget} of 3</span>
      </div>
    </section>
  );
}
