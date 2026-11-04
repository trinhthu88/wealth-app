import { useState } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import Sol from "@/components/Sol";
import { useProfile } from "@/hooks/useProfile";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { track } from "@/lib/analytics";

interface Props {
  condition: boolean;
  insightText: string;
  ctaText: string;
  ctaType: string;
}

/**
 * A dismissible Sol tip that nudges toward the Advisor tab (the upgrade
 * destination). Subscribed users get "Manage subscription" instead.
 */
export default function SmartUpgradeCard({ condition, insightText, ctaText, ctaType }: Props) {
  const key = `upgrade_dismissed_${ctaType}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === "1");
  const { profile } = useProfile();
  const isSubscribed = profile?.role === "investment_client";
  const manageSubscription = useManageSubscription();

  if (!condition || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(key, "1");
    setDismissed(true);
  };

  const ctaClass =
    "mt-3 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60";

  return (
    <div className="relative flex gap-3 rounded-[24px] bg-breeze p-4 pr-14">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/10"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <Sol size="sm" animate="none" className="shrink-0" />
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-forest">Sol noticed</div>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-forest text-pretty">{insightText}</p>
        {isSubscribed ? (
          <button
            type="button"
            onClick={() => {
              track("upgrade_cta_clicked", { location: ctaType, action: "manage_subscription" });
              manageSubscription.mutate();
            }}
            disabled={manageSubscription.isPending}
            className={ctaClass}
          >
            Manage subscription
          </button>
        ) : (
          <Link
            href="/free/advisor"
            onClick={() => track("upgrade_cta_clicked", { location: ctaType, action: "open_advisor" })}
            className={ctaClass}
          >
            {ctaText}
          </Link>
        )}
      </div>
    </div>
  );
}
