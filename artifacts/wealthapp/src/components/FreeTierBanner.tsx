import { useState } from "react";
import { X, Lock } from "lucide-react";

interface Props {
  feature: string;
  benefit: string;
  storageKey: string;
}

export default function FreeTierBanner({ feature, benefit, storageKey }: Props) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(`free_banner_${storageKey}`) === "1"
  );

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#042C53]/5 border border-[#042C53]/10 text-sm">
      <Lock className="h-3.5 w-3.5 text-[#042C53]/40 shrink-0" />
      <p className="flex-1 text-slate-600 text-xs leading-relaxed">
        <span className="font-semibold text-[#042C53]">Free plan:</span> {feature}.{" "}
        <span className="text-slate-500">{benefit}</span>{" "}
        <a
          href="mailto:hello@tala.app?subject=Upgrade%20to%20Investment%20Account"
          className="text-[#1D9E75] font-medium hover:underline whitespace-nowrap"
        >
          Talk to an advisor →
        </a>
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
