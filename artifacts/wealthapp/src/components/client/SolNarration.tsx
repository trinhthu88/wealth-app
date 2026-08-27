import { useState } from "react";
import { useLocation } from "wouter";
import Sol from "@/components/Sol";
import { cn } from "@/lib/utils";

interface Props {
  /** Bricolage 19.5px headline — one observation, in Sol's voice. Real numbers only. */
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
        <div className="text-[11.5px] font-bold tracking-[0.09em] uppercase text-[#C98A2E]">Sol</div>
        <div className={cn(
          "font-display text-[19.5px] font-medium leading-[1.28] tracking-[-0.01em] text-pretty",
          dark ? "text-paper" : "text-forest"
        )}>
          {line}
        </div>
        {open && detail ? (
          <div className="animate-rise-up">
            <div className={cn("text-[14px] leading-[1.55] mt-[9px] text-pretty", dark ? "text-mint" : "text-ink-60")}>{detail}</div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {advisorFirstName && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate("/client/messages"); }}
                  className={cn(
                    "text-[13px] font-semibold rounded-full px-[13px] py-[7px] transition-colors",
                    dark ? "bg-sun text-sun-ink hover:bg-sun/90" : "text-forest bg-sun-tint hover:bg-sun-tint/70"
                  )}
                >
                  Ask {advisorFirstName} about this
                </button>
              )}
              <span className={cn("text-[13px] font-semibold", dark ? "text-mint-dim" : "text-ink-20")}>Tap to close</span>
            </div>
          </div>
        ) : (
          detail && <div className="text-[12.5px] font-semibold text-[#C98A2E] mt-1.5">Why this matters →</div>
        )}
      </div>
    </div>
  );
}
