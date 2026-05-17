import { useState } from "react";
import { X } from "lucide-react";

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

  if (!condition || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(key, "1");
    setDismissed(true);
  };

  return (
    <div className="relative border-l-4 border-amber-400 bg-amber-50 rounded-xl p-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-6">
        <span className="text-lg shrink-0">💡</span>
        <div>
          <p className="text-sm text-foreground leading-snug">{insightText}</p>
          <a
            href={ctaHref}
            className="text-xs text-primary font-medium mt-1.5 inline-block hover:underline"
          >
            {ctaText} →
          </a>
        </div>
      </div>
    </div>
  );
}
