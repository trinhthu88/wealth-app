import { Link } from "wouter";
import { TRIAL_DAYS, UNLOCKS } from "@workspace/tier-policy";
import ClientAppShell from "@/components/client/AppShell";
import PlanPicker from "@/components/PlanPicker";
import { useEntitlements } from "@/hooks/useEntitlements";

/** Both doors into membership: a promoted client activating, and a free user joining. */
export default function ActivateMembership() {
  const { entitlements } = useEntitlements();
  const pending = !!entitlements?.membership.pendingPayment;
  const advisorName = entitlements?.advisor?.name;

  return (
    <ClientAppShell>
      <div className="mx-auto max-w-lg space-y-5" data-testid="activate-membership">
        <div>
          <h1 className="text-[22px] font-semibold text-forest">
            {pending ? "Activate your membership" : "Become a member"}
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-40">
            {pending && advisorName ? `${advisorName} is ready to work with you. ` : ""}
            Your first {TRIAL_DAYS} days are free. We ask for a card now and charge it when the trial ends, unless you cancel first.
          </p>
        </div>

        <div className="rounded-[24px] bg-surface p-5 text-[14px] leading-relaxed text-ink-40">
          <p><span className="font-semibold text-forest">Membership unlocks</span> {UNLOCKS.membership}.</p>
          <p className="mt-2"><span className="font-semibold text-forest">An advisor unlocks</span> {UNLOCKS.advisor}.</p>
        </div>

        <PlanPicker />

        <Link href="/client/dashboard" className="block text-center text-[14px] font-semibold text-green underline underline-offset-4">
          Not now
        </Link>
      </div>
    </ClientAppShell>
  );
}
