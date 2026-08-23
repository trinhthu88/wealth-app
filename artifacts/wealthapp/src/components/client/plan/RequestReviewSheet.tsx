import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import BottomSheet from "@/components/client/BottomSheet";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const URGENCY_OPTIONS = [
  { value: "routine",  label: "Routine review",        opening: "I'd like to request a routine review of my financial plan." },
  { value: "question", label: "I have a question",     opening: "I have a question about my financial plan and would like to discuss it." },
  { value: "life",     label: "Significant life change",opening: "I've had a significant life change and would like to review my plan accordingly." },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  advisorId: string | null;
  advisorName: string | null;
  completionPct: number;
  nextMilestoneTitle: string | null;
}

export default function RequestReviewSheet({
  isOpen, onClose, advisorId, advisorName, completionPct, nextMilestoneTitle,
}: Props) {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const [urgency, setUrgency] = useState("routine");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "Client";
  const selectedOption = URGENCY_OPTIONS.find(o => o.value === urgency)!;

  useEffect(() => {
    const opening = selectedOption.opening;
    const parts = [
      `Hi ${advisorName ?? "there"},`,
      "",
      opening,
      "",
      `Plan progress: ${completionPct}% of milestones complete.`,
      nextMilestoneTitle ? `Next milestone: ${nextMilestoneTitle}` : null,
      "",
      "Please let me know when you're available.",
      "",
      `Thanks,`,
      firstName,
    ].filter(l => l !== null).join("\n");
    setMessage(parts);
  }, [urgency, advisorName, completionPct, nextMilestoneTitle, firstName]);

  async function handleSend() {
    if (!advisorId || !message.trim()) return;
    setSending(true);
    try {
      await apiFetch("/client/plan/review-request", {
        method: "POST",
        body: JSON.stringify({ advisorId, message: message.trim() }),
      });
      toast.success(`Review request sent to ${advisorName ?? "your advisor"}`);
      onClose();
      setTimeout(() => navigate("/client/messages"), 1500);
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Request a review">
      <div className="space-y-5 pb-4">
        {advisorName && (
          <p className="text-sm text-ink-60">
            Your message will be sent to <span className="font-semibold text-forest">{advisorName}</span>.
          </p>
        )}

        {/* Urgency selector */}
        <div className="space-y-2">
          <span id="review-urgency-label" className="text-sm font-medium text-forest">Type of review</span>
          <div className="flex flex-col gap-2" role="group" aria-labelledby="review-urgency-label">
            {URGENCY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUrgency(opt.value)}
                aria-pressed={urgency === opt.value}
                className={cn(
                  "px-4 py-2.5 rounded-xl border text-sm font-medium text-left transition-all",
                  urgency === opt.value
                    ? "border-green bg-green-tint text-forest"
                    : "border-hairline text-ink-60 hover:border-green/30"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label htmlFor="review-message" className="text-sm font-medium text-forest">Message</label>
          <textarea
            id="review-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-hairline text-sm text-forest resize-none focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!message.trim() || sending || !advisorId}
          className="w-full py-3 rounded-xl bg-green text-white font-semibold text-sm hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Sending…" : "Send message"}
        </button>

        {!advisorId && (
          <p className="text-xs text-ink-40 text-center">
            No advisor assigned yet. Contact support to connect with an advisor.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
