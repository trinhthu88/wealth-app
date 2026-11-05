import { Link } from "wouter";
import { MEMBERSHIP_CHECKPOINTS } from "@workspace/tier-policy";
import { useCheckpoint } from "@/hooks/useCheckpoint";
import { checkpointCopy } from "@/lib/checkpointCopy";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useManageSubscription } from "@/hooks/useManageSubscription";

const ACTION = "inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60";
const QUIET = "text-[14px] font-semibold text-green underline underline-offset-4 disabled:opacity-60";

/** C11 and C12 when one is open; otherwise the way to manage an existing membership. */
export default function MembershipCard() {
  const { entitlements } = useEntitlements();
  const { checkpoint, dismiss } = useCheckpoint(MEMBERSHIP_CHECKPOINTS);
  const manage = useManageSubscription();
  if (!entitlements) return null;
  const manageable = !!entitlements.membership.manageUrl;

  if (checkpoint?.code === "C11_trial_ending") {
    const copy = checkpointCopy(checkpoint.code, checkpoint.snapshot);
    return (
      <section className="rounded-[24px] bg-surface p-5" data-testid="membership-trial-ending">
        <h2 className="text-[16px] font-semibold text-forest">Your free trial is ending</h2>
        <p className="mb-4 mt-1 text-[14px] leading-snug text-ink-40">{copy.body}</p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className={ACTION} disabled={manage.isPending} onClick={() => manage.mutate()}>{copy.action}</button>
          <button type="button" className={QUIET} disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>Dismiss</button>
        </div>
      </section>
    );
  }

  if (checkpoint?.code === "C12_lapsed") {
    const copy = checkpointCopy(checkpoint.code, checkpoint.snapshot);
    return (
      <section className="rounded-[24px] bg-surface p-5" data-testid="membership-lapsed">
        <h2 className="text-[16px] font-semibold text-forest">Your membership has ended</h2>
        <p className="mb-4 mt-1 text-[14px] leading-snug text-ink-40">{copy.body}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/client/activate" className={ACTION}>{copy.action}</Link>
          <button type="button" className={QUIET} disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>Dismiss</button>
        </div>
      </section>
    );
  }

  if (!manageable || !entitlements.membership.isActive) return null;
  return (
    <div className="px-1 text-right" data-testid="membership-manage">
      <button type="button" className={QUIET} disabled={manage.isPending} onClick={() => manage.mutate()}>Manage membership</button>
    </div>
  );
}
