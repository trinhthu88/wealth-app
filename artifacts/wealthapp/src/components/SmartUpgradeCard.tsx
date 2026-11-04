import { useState } from "react";
import { X } from "lucide-react";
import Sol from "@/components/Sol";
import TalkToAdvisorButton from "@/components/TalkToAdvisorButton";
import { useProfile } from "@/hooks/useProfile";
import { useManageSubscription } from "@/hooks/useManageSubscription";
import { track } from "@/lib/analytics";

interface Props {
  condition: boolean;
  insightText: string;
  ctaText: string;
  ctaType: string;
}

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

  return (
    <div className="relative bg-primary/5 border border-primary/20 rounded-xl p-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-6 items-start">
        <Sol size="xs" animate="idle" showFace className="shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-foreground leading-snug">{insightText}</p>
          {isSubscribed ? (
            <button
              type="button"
              onClick={() => {
                track("upgrade_cta_clicked", { location: ctaType, action: "manage_subscription" });
                manageSubscription.mutate();
              }}
              disabled={manageSubscription.isPending}
              className="text-xs text-primary font-medium mt-1.5 inline-block hover:underline disabled:opacity-60"
            >
              Manage subscription →
            </button>
          ) : (
            <TalkToAdvisorButton
              source="C7_direct"
              location={ctaType}
              className="text-xs text-primary font-medium mt-1.5 inline-block hover:underline disabled:opacity-60"
            >
              {ctaText} →
            </TalkToAdvisorButton>
          )}
        </div>
      </div>
    </div>
  );
}
