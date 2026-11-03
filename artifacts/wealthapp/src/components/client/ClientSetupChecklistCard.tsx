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
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${item.done ? "bg-forest text-paper" : "bg-field text-forest"}`}>
        {item.done ? <Check className="h-3.5 w-3.5" /> : <ChevronRight className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className={`block text-[14px] font-semibold ${item.done ? "text-ink-40 line-through decoration-ink-40/40" : "text-forest"}`}>{item.title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-40">{item.description}</span>
      </span>
      {!item.done && item.href && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-paper"><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>}
    </>
  );

  return (
    <div className="border-b border-hairline p-3 last:border-0" data-testid={`checklist-item-${item.id}`}>
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
        <button type="button" onClick={onStartingFromZero} disabled={pending} data-testid="button-starting-from-zero" className="ml-[52px] mt-1 min-h-11 text-[13px] font-semibold text-green underline decoration-green/40 underline-offset-4 hover:text-forest disabled:opacity-50">
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
    return <div className="space-y-3 rounded-[24px] bg-surface p-5" aria-label="Loading setup checklist" data-testid="checklist-loading"><div className="h-4 w-2/5 animate-pulse rounded-full bg-forest/10" /><div className="h-20 animate-pulse rounded-[20px] bg-paper" /><div className="h-16 animate-pulse rounded-[20px] bg-paper" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-[24px] bg-surface p-5" data-testid="checklist-error">
        <p className="text-[16px] font-semibold text-forest">Your setup steps are taking a moment.</p>
        <p className="mt-1 text-[14px] text-ink-40">Try again to load your advisor-guided checklist.</p>
        <button type="button" onClick={() => void refetch()} data-testid="button-retry-checklist" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper"><RotateCw className="h-4 w-4" /> Try again</button>
      </div>
    );
  }

  const allDone = data.items.length > 0 && data.items.every(item => item.done);
  if (data.checklistHidden || allDone) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[24px] bg-surface px-4 py-2" data-testid="checklist-hidden">
        <p className="py-2 text-[14px] text-ink-40">{allDone ? "Your setup checklist is complete." : "Your setup checklist is hidden."}</p>
        {data.checklistHidden && <button type="button" onClick={() => void savePreference({ checklistHidden: false })} disabled={pendingPreference} data-testid="button-show-checklist" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-green hover:bg-forest/5 disabled:opacity-50"><Eye className="h-4 w-4" /> Show again</button>}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] bg-surface p-5" data-testid="card-client-setup-checklist">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="tala-eyebrow text-ink-40">Your next steps</p>
          <h2 className="mt-1.5 text-[16px] font-semibold leading-tight text-forest">A few things to settle in</h2>
          <p className="mt-1 text-[13px] text-ink-40">Your advisor is here to help, one step at a time.</p>
        </div>
        <button type="button" onClick={() => void savePreference({ checklistHidden: true })} disabled={pendingPreference} aria-label="Hide setup checklist" data-testid="button-hide-checklist" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-40 hover:bg-paper hover:text-forest disabled:opacity-50"><EyeOff className="h-4 w-4" /></button>
      </header>
      <div className="mt-4 rounded-[20px] bg-paper p-1">
        {data.items.map(item => <SetupItem key={item.id} item={item} onRiskCheck={onRiskCheck} onStartingFromZero={() => void savePreference({ startingFromZero: true })} pending={pendingPreference} />)}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-[14px] bg-breeze px-3.5 py-3 text-[13px] text-forest" data-testid="wealth-score-unlock">
        <LoaderCircle className="h-4 w-4 shrink-0 text-forest" aria-hidden="true" />
        <span>Wealth score unlocks after 3 months of budget: {data.wealthScoreUnlock.monthsWithBudget} of 3</span>
      </div>
    </section>
  );
}
