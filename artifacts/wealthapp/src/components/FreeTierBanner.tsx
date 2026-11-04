import { useState } from "react";
import { X } from "lucide-react";
import Sol from "@/components/Sol";
import TalkToAdvisorButton from "@/components/TalkToAdvisorButton";
import { useProfile } from "@/hooks/useProfile";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { track } from "@/lib/analytics";

interface Props {
  feature: string;
  benefit: string;
  storageKey: string;
}

/**
 * Free-plan Sol tip card (Blue Breeze). The CTA routes to the Advisor tab,
 * where the plans live; dismissal is remembered per page via `storageKey`.
 */
export default function FreeTierBanner({ feature, benefit, storageKey }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(`free_banner_${storageKey}`) === "1"; } catch { return false; }
  });
  const { profile } = useProfile();
  const isSubscribed = profile?.role === "investment_client";
  const manageSubscription = useManageSubscription();

  if (dismissed) return null;

  const location = `free_tier_banner_${storageKey}`;
  const ctaClass =
    "mt-3 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-60";

  return (
    <section
      aria-label="Your plan"
      className="relative flex items-start gap-3 rounded-[24px] bg-breeze p-4 pr-12 text-forest"
    >
      <div className="shrink-0 mt-0.5">
        <Sol size="sm" animate="idle" showRays={false} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold leading-[1.45] text-pretty">{feature}.</p>
        <p className="mt-1 text-[13px] leading-[1.5] text-forest/80 text-pretty">{benefit}</p>
        {isSubscribed ? (
          <button
            type="button"
            onClick={() => {
              track("upgrade_cta_clicked", { location, action: "manage_subscription" });
              manageSubscription.mutate();
            }}
            disabled={manageSubscription.isPending}
            className={ctaClass}
          >
            Manage subscription
          </button>
        ) : (
          <TalkToAdvisorButton
            source="C7_direct"
            location={location}
            className={ctaClass}
          >
            Talk to an advisor
          </TalkToAdvisorButton>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          try { localStorage.setItem(`free_banner_${storageKey}`, "1"); } catch { /* storage unavailable */ }
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full text-forest/60 transition-colors hover:bg-forest/10 hover:text-forest"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}
