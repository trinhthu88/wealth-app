import { Link } from "wouter";
import { useEntitlements } from "@/hooks/useEntitlements";
import { acceptedCheckpointCopy, advisorCardState } from "@/lib/advisorCard";
import TalkToAdvisorButton from "@/components/TalkToAdvisorButton";

const ACTION = "inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60";

/** The user's conversion state, driven by leads.status through entitlements. */
export default function AdvisorCard() {
  const { entitlements } = useEntitlements();
  if (!entitlements) return null;

  const { advisor } = entitlements;
  const state = advisorCardState(entitlements.tier, entitlements.leadStatus, !!advisor, entitlements.membership?.pendingPayment ?? false);
  const advisorName = advisor?.name ?? "Your advisor";
  const firstName = advisorName.split(" ")[0];
  const initials = advisorName.split(" ").map((part) => part[0]).join("");

  if (state === "none") {
    return (
      <section className="rounded-[24px] bg-surface p-5" data-testid="advisor-card-none">
        <h2 className="text-[16px] font-semibold text-forest">No advisor yet</h2>
        <p className="mb-4 mt-1 text-[14px] leading-snug text-ink-40">
          An advisor can look through your goals and numbers with you, whenever you're ready.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <TalkToAdvisorButton source="C7_direct" location="dashboard_advisor_card" className={ACTION} />
          <Link href="/client/activate" className="text-[14px] font-semibold text-green underline underline-offset-4">Become a member</Link>
        </div>
      </section>
    );
  }

  if (state === "activate") {
    return (
      <section className="rounded-[24px] bg-surface p-5" data-testid="advisor-card-activate">
        <h2 className="text-[16px] font-semibold text-forest">{advisorName} is your advisor</h2>
        <p className="mb-4 mt-1 text-[14px] leading-snug text-ink-40">Activate your membership to start working together.</p>
        <Link href="/client/activate" className={ACTION}>Activate to start</Link>
      </section>
    );
  }

  if (state === "matching") {
    return (
      <section className="rounded-[24px] bg-surface p-5" data-testid="advisor-card-matching">
        <h2 className="text-[16px] font-semibold text-forest">We are matching you with an advisor</h2>
        <p className="mt-1 text-[14px] leading-snug text-ink-40">
          {acceptedCheckpointCopy(entitlements.leadSource)} Your goals and numbers stay exactly as they are.
        </p>
      </section>
    );
  }

  if (state === "assigned") {
    return (
      <section className="rounded-[24px] bg-surface p-5" data-testid="advisor-card-assigned">
        <h2 className="text-[16px] font-semibold text-forest">{advisorName} is your advisor</h2>
        <p className="mb-4 mt-1 text-[14px] leading-snug text-ink-40">Messages and documents are open between you now.</p>
        <Link href="/client/advisor/messages" className={ACTION}>Say hello</Link>
      </section>
    );
  }

  return (
    <Link href="/client/advisor/messages" className="block" data-testid="advisor-card-client">
      <div className="cursor-pointer rounded-[24px] bg-surface p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold text-forest">Your advisor</h2>
          <span className="text-[14px] font-semibold text-green underline underline-offset-4">Message</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-field text-[14px] font-semibold text-forest">
            {initials}
          </div>
          <div className="text-pretty text-[14px] leading-[1.45] text-ink-40">
            {firstName}: "Need an adjustment to your plan? Send a message directly."
          </div>
        </div>
      </div>
    </Link>
  );
}
