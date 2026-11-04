import { useState } from "react";
import { X } from "lucide-react";
import PlanPicker from "@/components/PlanPicker";
import BottomSheet from "@/components/client/BottomSheet";
import Sol from "@/components/Sol";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const { profile } = useProfile();
  const isSubscribed = profile?.role === "investment_client";
  const manageSubscription = useManageSubscription();

  if (dismissed) return null;

  const location = `free_tier_banner_${storageKey}`;

  function handleCtaClick() {
    track("upgrade_cta_clicked", { location, action: isSubscribed ? "manage_subscription" : "open_plan_picker" });
    if (isSubscribed) {
      manageSubscription.mutate();
      return;
    }
    setSheetOpen(true);
  }

  return (
    <section
      aria-label="Your plan"
      className="relative flex items-start gap-3 rounded-[24px] bg-breeze p-5 pr-12"
    >
      <div className="shrink-0 mt-0.5">
        <Sol size="sm" animate="idle" showRays={false} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="tala-eyebrow text-forest/70">Free plan</p>
        <p className="mt-1 text-[14px] font-medium leading-[1.45] text-forest text-pretty">{feature}.</p>
        <p className="mt-1 text-[13px] leading-[1.5] text-forest/75 text-pretty">{benefit}</p>
        <button
          type="button"
          onClick={handleCtaClick}
          disabled={manageSubscription.isPending}
          className="mt-3.5 inline-flex h-11 items-center rounded-full bg-forest px-5 text-[14px] font-semibold text-paper whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isSubscribed ? "Manage subscription" : "Upgrade your plan"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(`free_banner_${storageKey}`, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-forest/60 transition-colors hover:bg-forest/10 hover:text-forest"
      >
        <X className="h-4 w-4" />
      </button>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Choose your plan">
        <PlanPicker />
      </BottomSheet>
    </section>
  );
}
