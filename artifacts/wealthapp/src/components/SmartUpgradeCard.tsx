import { useState } from "react";
import { X } from "lucide-react";
import Sol from "@/components/Sol";
import PlanPicker from "@/components/PlanPicker";
import BottomSheet from "@/components/client/BottomSheet";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const { profile } = useProfile();
  const isSubscribed = profile?.role === "investment_client";
  const manageSubscription = useManageSubscription();

  if (!condition || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(key, "1");
    setDismissed(true);
  };

  function handleCtaClick() {
    track("upgrade_cta_clicked", { location: ctaType, action: isSubscribed ? "manage_subscription" : "open_plan_picker" });
    if (isSubscribed) {
      manageSubscription.mutate();
      return;
    }
    setSheetOpen(true);
  }

  return (
    <div className="relative rounded-[24px] bg-breeze p-5 pr-14">
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/10"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-3">
        <Sol size="sm" animate="none" className="shrink-0" />
        <div className="min-w-0">
          <div className="tala-eyebrow text-forest">Sol noticed</div>
          <p className="mt-1 text-[14px] leading-[1.5] text-forest text-pretty">{insightText}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCtaClick}
        disabled={manageSubscription.isPending}
        className="mt-4 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isSubscribed ? "Manage subscription" : ctaText}
      </button>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Choose your plan">
        <PlanPicker />
      </BottomSheet>
    </div>
  );
}
