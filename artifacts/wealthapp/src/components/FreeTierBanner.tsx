import { useState } from "react";
import { X, Lock } from "lucide-react";
import TalkToAdvisorButton from "@/components/TalkToAdvisorButton";
import { useProfile } from "@/hooks/useProfile";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { track } from "@/lib/analytics";

interface Props {
  feature: string;
  benefit: string;
  storageKey: string;
}

export default function FreeTierBanner({ feature, benefit, storageKey }: Props) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`free_banner_${storageKey}`) === "1"
  );
  const { profile } = useProfile();
  const isSubscribed = profile?.role === "investment_client";
  const manageSubscription = useManageSubscription();

  if (dismissed) return null;

  const location = `free_tier_banner_${storageKey}`;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0C21A4]/5 border border-[#0C21A4]/10 text-sm">
      <Lock className="h-3.5 w-3.5 text-[#0C21A4]/40 shrink-0" />
      <p className="flex-1 text-slate-600 text-xs leading-relaxed">
        <span className="font-semibold text-[#0C21A4]">Free plan:</span> {feature}.{" "}
        <span className="text-slate-500">{benefit}</span>{" "}
        {isSubscribed ? (
          <button
            type="button"
            onClick={() => {
              track("upgrade_cta_clicked", { location, action: "manage_subscription" });
              manageSubscription.mutate();
            }}
            disabled={manageSubscription.isPending}
            className="text-[#0C21A4] font-medium hover:underline whitespace-nowrap disabled:opacity-60"
          >
            Manage subscription →
          </button>
        ) : (
          <TalkToAdvisorButton
            source="C7_direct"
            location={location}
            className="text-[#0C21A4] font-medium hover:underline whitespace-nowrap disabled:opacity-60"
          >
            Talk to an advisor →
          </TalkToAdvisorButton>
        )}
      </p>
      <button
        onClick={() => {
          localStorage.setItem(`free_banner_${storageKey}`, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
