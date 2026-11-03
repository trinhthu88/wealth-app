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
          className="w-full px-3 py-2 rounded-xl border border-[#E3E9FD] text-sm text-[#0C21A4] placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#0C21A4]/30 focus:border-[#0C21A4]"
        />
        <span className="absolute bottom-2 right-3 text-[10px] text-slate-300">
          {text.length}/{MAX}
        </span>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={!text.trim() || text.length > MAX || sending}
          className="px-4 py-1.5 rounded-lg bg-[#0C21A4] text-white text-xs font-medium hover:bg-[#08167A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
