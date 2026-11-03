import { useState } from "react";
import { useLocation } from "wouter";
import Sol from "@/components/Sol";
import { cn } from "@/lib/utils";

interface Props {
  /** One-line headline — one observation, in Sol's voice. Real numbers only. */
  line: string;
  /** Longer explanation shown when tapped open — the "why this matters", never a directive. */
  detail?: string;
  /** First name to route the advisor-escalation pill to, e.g. "Ask Trang about this". */
  advisorFirstName?: string | null;
  /** Use on a dark (forest) background, e.g. the Pathway screen. */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Sol's per-screen observation banner. Collapsed by default; tapping expands
 * the detail paragraph and an "Ask {advisor} about this" pill that routes to
 * Messages — Sol explains, it never directs (see SOL_PERSONA.md).
 */
export default function SolNarration({ line, detail, advisorFirstName, tone = "light", className }: Props) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const dark = tone === "dark";

  return (
    <div className={cn("flex items-start gap-3 mb-[18px] cursor-pointer", className)} onClick={() => setOpen(v => !v)}>
      <div className="shrink-0 mt-0.5">
        <Sol size="sm" animate="breathe" />
      </div>
      <div className="pt-0.5 min-w-0">
        <div className={cn("tala-eyebrow", dark ? "text-mint" : "text-ink-40")}>Sol</div>
        <div className={cn(
          "text-[16px] font-medium leading-[1.4] mt-1 text-pretty",
          dark ? "text-paper" : "text-forest"
        )}>
          {line}
        </div>
        {open && detail ? (
          <div className="animate-rise-up">
            <div className={cn("text-[14px] leading-[1.55] mt-2 text-pretty", dark ? "text-mint" : "text-ink-40")}>{detail}</div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {advisorFirstName && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate("/client/advisor/messages"); }}
                  className={cn(
                    "min-h-11 text-[14px] font-semibold rounded-full px-5 transition-opacity hover:opacity-90",
                    dark ? "bg-field text-forest" : "bg-forest text-paper"
                  )}
                >
                  Ask {advisorFirstName} about this
                </button>
              )}
              <span className={cn("text-[13px] font-medium", dark ? "text-mint" : "text-ink-40")}>Tap to close</span>
            </div>
          </div>
        ) : (
          detail && <div className={cn("text-[13px] font-semibold underline underline-offset-4 mt-1.5", dark ? "text-mint" : "text-forest")}>Why this matters →</div>
        )}
      </div>
    </div>
  );
}
