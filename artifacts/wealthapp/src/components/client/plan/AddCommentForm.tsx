import { useState } from "react";
import { cn } from "@/lib/utils";

const MAX = 500;

interface Props {
  milestoneId: string;
  onAdd: (content: string) => Promise<void>;
  error: string | null;
}

export default function AddCommentForm({ milestoneId, onAdd, error }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSend() {
    if (!text.trim() || text.length > MAX) return;
    setSending(true);
    setLocalError(null);
    try {
      await onAdd(text.trim());
      setText("");
    } catch {
      setLocalError("Failed to send — try again.");
    } finally {
      setSending(false);
    }
  }

  const err = localError ?? error;

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note or question about this milestone..."
          rows={2}
          maxLength={MAX}
          className="w-full px-4 py-3 pb-6 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-40 resize-none focus:outline-none focus:ring-2 focus:ring-forest/30"
        />
        <span className="absolute bottom-2 right-3 text-[11px] text-ink-40 tabular-nums">
          {text.length}/{MAX}
        </span>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={!text.trim() || text.length > MAX || sending}
          className="h-10 px-5 rounded-full bg-forest text-paper text-[13px] font-semibold hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
