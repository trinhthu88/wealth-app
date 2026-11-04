import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ClientAppShell from "@/components/client/AppShell";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useProfile } from "@/hooks/useProfile";
import { usePlan } from "@/hooks/usePlan";
import { MessageSquare, Send } from "lucide-react";
import Sol from "@/components/Sol";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import RequestReviewSheet from "@/components/client/plan/RequestReviewSheet";

interface Conversation { id: string; clientId: string; advisorId: string; lastMessageAt: string | null; }
interface Message { id: string; senderId: string; senderRole: string | null; content: string; sentAt: string; createdAt?: string; }
interface ClientProfilePreferences { shareBudgetWithAdvisor: boolean; }

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ClientMessages() {
  const { profile } = useProfile();
  const { advisorName, advisorId, completionPct, nextMilestone } = usePlan();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [msg, setMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false); // local typing feedback
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: clientPreferences, isPending: clientPreferencesPending } = useQuery<ClientProfilePreferences>({
    queryKey: ["client-profile-me"],
    queryFn: () => apiFetch<ClientProfilePreferences>("/client-profile/me"),
  });

  const updateBudgetSharing = useMutation({
    mutationFn: (shareBudgetWithAdvisor: boolean) => apiFetch<ClientProfilePreferences>("/client-profile/me", {
      method: "PUT",
      body: JSON.stringify({ shareBudgetWithAdvisor }),
    }),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["client-profile-me"], preferences);
      toast.success(preferences.shareBudgetWithAdvisor ? "Budget summary sharing enabled" : "Budget summary sharing disabled");
    },
    onError: () => toast.error("Could not update budget sharing"),
  });

  const { data: convs = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => apiFetch<Conversation[]>("/conversations"),
  });
  const activeConv = convs.find(c => c.id === activeConvId) ?? convs[0];

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["messages", activeConv?.id],
    queryFn: () => apiFetch<Message[]>(`/conversations/${activeConv!.id}/messages`),
    enabled: !!activeConv,
    refetchInterval: 10000,
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      apiFetch(`/conversations/${activeConv!.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", activeConv?.id] });
      setMsg("");
    },
    onError: () => toast.error("Failed to send"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // "Ask about [holding]" pre-fill from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const about = params.get("about");
    if (about) {
      setMsg(`Hi, I have a question about my ${about}.\n\n`);
      setTimeout(() => {
        textareaRef.current?.focus();
        const len = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(len, len);
      }, 100);
      window.history.replaceState({}, "", "/client/advisor/messages");
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMsg(e.target.value);
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setIsTyping(false), 2000);
  }

  function handleSend() {
    if (!msg.trim() || send.isPending) return;
    setIsTyping(false);
    send.mutate(msg.trim());
  }

  const advisorInitials = advisorName ? advisorName.split(" ").map(p => p[0]).join("").toUpperCase() : "A";

  return (
    <ClientAppShell>
      <div className="h-full flex flex-col max-w-[860px] mx-auto">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h1 className="font-display text-[34px] leading-[1.05] text-forest">Messages</h1>
          <button
            type="button"
            onClick={() => setShowReviewSheet(true)}
            className="shrink-0 h-11 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper hover:bg-forest-700 transition-colors"
          >
            Request a review
          </button>
        </div>

        <div className="bg-surface rounded-[24px] p-5 mb-4">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-[14px] font-medium text-forest">Share my monthly budget summary with my advisor</span>
            <input
              type="checkbox"
              checked={clientPreferences?.shareBudgetWithAdvisor ?? false}
              disabled={clientPreferencesPending || updateBudgetSharing.isPending}
              onChange={event => updateBudgetSharing.mutate(event.target.checked)}
              className="h-5 w-5 shrink-0 accent-[var(--forest)]"
            />
          </label>
          <p className="text-[13px] leading-[1.5] text-ink-40 mt-2">
            When enabled, your advisor can see monthly income, spending, surplus, and savings rate only. Budget line items stay private.
          </p>
        </div>

        {convs.length === 0 ? (
          <div className="bg-surface rounded-[24px] p-10 text-center flex flex-col items-center gap-4">
            <Sol size="lg" animate="float" showFace />
            <div>
              <h3 className="text-[16px] font-semibold text-forest mb-1">No messages yet</h3>
              <p className="text-ink-40 text-[14px]">Send your advisor a message to get started.</p>
            </div>
          </div>
        ) : (
          <div className="bg-surface rounded-[28px] overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="border-b border-hairline p-4 flex items-center gap-3 shrink-0">
              <div className="w-11 h-11 rounded-[14px] bg-field flex-none flex items-center justify-center text-[13px] font-semibold text-forest">
                {advisorInitials}
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-forest truncate">{advisorName ?? "Your advisor"}</div>
                <div className="text-[12px] text-ink-40 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-forest" aria-hidden="true" />
                  Your advisor
                </div>
              </div>
            </div>

            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation with your advisor"
              aria-atomic="false"
              aria-relevant="additions"
              className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1"
            >
              {messages.length === 0 && (
                <p className="text-center text-[14px] text-ink-40 pt-8">
                  No messages yet. Start the conversation!
                </p>
              )}
              {(() => {
                const byDate: Record<string, Message[]> = {};
                for (const m of messages) {
                  const ts = m.sentAt ?? m.createdAt ?? "";
                  const key = ts ? new Date(ts).toDateString() : "Unknown";
                  if (!byDate[key]) byDate[key] = [];
                  byDate[key].push(m);
                }
                return Object.entries(byDate).map(([dateKey, dayMessages]) => (
                  <div key={dateKey}>
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-hairline" />
                      <span className="text-[12px] font-medium text-ink-40 shrink-0">
                        {dateKey !== "Unknown" ? formatDateSeparator(dateKey) : ""}
                      </span>
                      <div className="flex-1 h-px bg-hairline" />
                    </div>
                    {dayMessages.map(m => {
                      const isMe = m.senderId === profile?.id;
                      const timestamp = m.sentAt ?? m.createdAt ?? "";
                      return (
                        <div key={m.id} className={cn("flex mb-2.5", isMe ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[78%] px-[15px] py-3 rounded-[20px] text-[14px] leading-[1.5] text-pretty",
                            isMe
                              ? "bg-forest text-paper rounded-br-md"
                              : "bg-paper text-forest rounded-bl-md"
                          )}>
                            <p>{m.content}</p>
                            <p className={cn("text-[11px] mt-1 tabular-nums", isMe ? "text-mint" : "text-ink-40")}>
                              {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}

              {isTyping && (
                <div
                  role="status"
                  aria-label="Composing message"
                  className="flex items-center gap-1 px-3 py-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-breeze animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-breeze animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-breeze animate-bounce [animation-delay:300ms]" />
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="border-t border-hairline p-3 flex gap-2 shrink-0">
              <textarea
                ref={textareaRef}
                placeholder={`Write to ${advisorName?.split(" ")[0] ?? "your advisor"}…`}
                value={msg}
                onChange={handleInputChange}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                className="flex-1 px-4 py-3 rounded-[20px] border border-hairline bg-paper text-[14px] text-forest placeholder:text-ink-40 resize-none focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim() || send.isPending}
                aria-label="Send message"
                className="h-11 w-11 self-end flex items-center justify-center rounded-full bg-forest text-paper hover:bg-forest-700 disabled:bg-hairline disabled:text-ink-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      <RequestReviewSheet
        isOpen={showReviewSheet}
        onClose={() => setShowReviewSheet(false)}
        advisorId={advisorId}
        advisorName={advisorName}
        completionPct={completionPct}
        nextMilestoneTitle={nextMilestone?.title ?? null}
      />
    </ClientAppShell>
  );
}
