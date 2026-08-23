import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import Sol from "./Sol";
import { useSolChat } from "@/hooks/useSolChat";
import { cn } from "@/lib/utils";

// Sol's chat backend (POST /sol/chat) is a real LLM call — if it's unreachable
// or errors, this is what the client sees instead of a broken chat. Not a
// generateSolCopy() call: that function's SolObservation union has no variant
// for "the assistant itself is unavailable," only for specific data insights.
const UNAVAILABLE_MESSAGE =
  "I'm having trouble connecting right now — try again in a moment, or reach out to your advisor in the meantime.";

interface Props {
  open: boolean;
  greeting: string;
}

export default function SolChat({ open, greeting }: Props) {
  const { messages, loading, send, sending, sendFailed } = useSolChat(open);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending, sendFailed]);

  function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    send(text);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <div className="flex items-start gap-3">
          <Sol size="sm" animate="breathe" />
          <div className="bg-surface rounded-2xl rounded-tl-none p-4 shadow-sm max-w-[80%] border border-hairline">
            <p className="text-sm text-forest leading-relaxed text-pretty">{greeting}</p>
          </div>
        </div>

        {!loading && messages.map(m => (
          <div key={m.id} className={cn("flex items-start gap-3", m.role === "user" && "flex-row-reverse")}>
            {m.role === "assistant" && <Sol size="sm" animate="none" />}
            <div
              className={cn(
                "rounded-2xl p-4 shadow-sm max-w-[80%] text-sm leading-relaxed text-pretty",
                m.role === "user"
                  ? "bg-green text-paper rounded-tr-none"
                  : "bg-surface text-forest border border-hairline rounded-tl-none",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-start gap-3" aria-live="polite" aria-label="Sol is typing">
            <Sol size="sm" animate="pulse" />
            <div className="bg-surface rounded-2xl rounded-tl-none p-4 shadow-sm border border-hairline">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-20 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-20 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-20 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {sendFailed && !sending && (
          <div className="flex items-start gap-3">
            <Sol size="sm" animate="none" />
            <div className="bg-surface rounded-2xl rounded-tl-none p-4 shadow-sm max-w-[80%] border border-hairline">
              <p className="text-sm text-forest leading-relaxed text-pretty">{UNAVAILABLE_MESSAGE}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-hairline flex items-center gap-2 shrink-0">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask Sol anything..."
          aria-label="Message Sol"
          className="flex-1 h-11 px-4 rounded-full border border-hairline bg-paper text-sm text-forest placeholder:text-ink-40 focus:outline-none focus:border-green"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="h-11 w-11 shrink-0 rounded-full bg-green text-paper flex items-center justify-center disabled:opacity-40 transition-opacity"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
