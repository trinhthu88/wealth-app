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
    <div className={cn("flex items-start gap-3 p-4 rounded-[24px] bg-breeze text-forest", className)}>
      <Sol size="xs" animate="none" showFace showRays={false} className="mt-0.5" />
      <div className="flex-1 min-w-0 text-[14px] text-forest leading-[1.5]">
        <p>{message.body}</p>
        {onAccept && message.actionLabel && (
          <button
            onClick={onAccept}
            className="mt-3 inline-flex items-center h-11 px-5 rounded-full bg-forest text-paper font-semibold text-[14px] hover:bg-forest-700 transition-colors cursor-pointer"
          >
            {message.actionLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 -mt-2 -mr-2 h-11 w-11 flex items-center justify-center rounded-full text-forest/60 hover:text-forest transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
