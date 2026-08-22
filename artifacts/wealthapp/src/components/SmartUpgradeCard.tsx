import { useState } from "react";
import { X } from "lucide-react";
import Sol from "@/components/Sol";
import { useCreateLeadFromInterest } from "@/hooks/useCreateLeadFromInterest";

interface Props {
  condition: boolean;
  insightText: string;
  ctaText: string;
  ctaHref?: string;
  ctaType: string;
}

export default function SmartUpgradeCard({ condition, insightText, ctaText, ctaHref = "/book", ctaType }: Props) {
  const key = `upgrade_dismissed_${ctaType}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === "1");
  const createLead = useCreateLeadFromInterest();

  if (!condition || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(key, "1");
    setDismissed(true);
  };

  // ctaHref is a real external page (e.g. /book) — a plain <a> click would
  // unload this page immediately, which can abort an in-flight fetch. Await
  // the (best-effort) lead-creation call first, then navigate.
  async function handleCtaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    try {
      await createLead.mutateAsync("smart_upgrade_card");
    } catch {
      // never block navigation on this — it's a side effect, not the point of the click
    }
    window.location.href = ctaHref;
  }

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
          <a
            href={ctaHref}
            onClick={handleCtaClick}
            className="text-xs text-primary font-medium mt-1.5 inline-block hover:underline"
          >
            {ctaText} →
          </a>
        </div>
      </div>
    </div>
  );
}
