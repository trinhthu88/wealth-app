import { useState } from "react";
import { X, Lock } from "lucide-react";
import PlanPicker from "@/components/PlanPicker";
import BottomSheet from "@/components/client/BottomSheet";
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
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#042C53]/5 border border-[#042C53]/10 text-sm">
      <Lock className="h-3.5 w-3.5 text-[#042C53]/40 shrink-0" />
      <p className="flex-1 text-slate-600 text-xs leading-relaxed">
        <span className="font-semibold text-[#042C53]">Free plan:</span> {feature}.{" "}
        <span className="text-slate-500">{benefit}</span>{" "}
        <button
          type="button"
          onClick={handleCtaClick}
          disabled={manageSubscription.isPending}
          className="text-[#1D9E75] font-medium hover:underline whitespace-nowrap disabled:opacity-60"
        >
          {isSubscribed ? "Manage subscription" : "Upgrade your plan"} →
        </button>
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

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Choose your plan">
        <PlanPicker />
      </BottomSheet>
    </div>
  );
}
