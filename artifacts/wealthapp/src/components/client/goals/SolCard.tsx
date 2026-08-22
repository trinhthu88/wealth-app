import { X } from "lucide-react";
import Sol from "@/components/Sol";
import type { SolMessage } from "@/lib/sol";
import { cn } from "@/lib/utils";

interface Props {
  message: SolMessage;
  onAccept?: () => void;
  onDismiss?: () => void;
  className?: string;
}

// A single Sol observation, phrased by generateSolCopy (see @/lib/sol) and
// rendered as a small card. The client always taps to act — this never links,
// dismisses, or navigates on its own.
export default function SolCard({ message, onAccept, onDismiss, className }: Props) {
  return (
    <div className={cn("flex items-start gap-2.5 p-3 rounded-xl bg-sun-tint border border-sun/30", className)}>
      <Sol size="xs" animate="none" showFace showRays={false} className="mt-0.5" />
      <div className="flex-1 min-w-0 text-[13px] text-sun-ink leading-[1.45]">
        <p>{message.body}</p>
        {onAccept && message.actionLabel && (
          <button
            onClick={onAccept}
            className="mt-1.5 font-semibold text-[13px] text-[#1D9E75] hover:underline cursor-pointer"
          >
            {message.actionLabel} →
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 h-5 w-5 flex items-center justify-center text-sun-ink/40 hover:text-sun-ink transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
