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

interface Conversation { id: string; clientId: string; advisorId: string; lastMessageAt: string | null; }
interface Message { id: string; senderId: string; senderRole: string | null; content: string; sentAt: string; createdAt?: string; }

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
  const { advisorName } = usePlan();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false); // local typing feedback
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      window.history.replaceState({}, "", "/client/messages");
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
        <h1 className="font-display text-[26px] font-semibold text-forest tracking-[-0.02em] mb-4 shrink-0">Messages</h1>

        {convs.length === 0 ? (
          <div className="bg-surface border border-hairline rounded-[24px] p-12 text-center flex flex-col items-center gap-4 shadow-[0_2px_14px_rgba(20,52,42,.06)]">
            <Sol size="lg" animate="float" showFace />
            <div>
              <h3 className="font-display font-semibold text-forest mb-1">No messages yet</h3>
              <p className="text-ink-40 text-sm">Send your advisor a message to get started.</p>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-hairline rounded-[24px] shadow-[0_2px_14px_rgba(20,52,42,.06)] overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="border-b border-hairline px-4 py-3.5 flex items-center gap-3 shrink-0">
              <div className="w-[38px] h-[38px] rounded-full bg-[#DCEAE3] flex-none flex items-center justify-center text-[13px] font-semibold text-forest">
                {advisorInitials}
              </div>
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold text-forest truncate">{advisorName ?? "Your advisor"}</div>
                <div className="text-[12px] text-ink-40 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-green" aria-hidden="true" />
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
                <p className="text-center text-sm text-ink-30 pt-8">
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
                      <span className="text-xs text-ink-30 shrink-0">
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
                            <p className={cn("text-[11px] mt-1", isMe ? "text-mint" : "text-ink-30")}>
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
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-20 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-20 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-20 animate-bounce [animation-delay:300ms]" />
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
                className="flex-1 px-4 py-3 rounded-[18px] border border-hairline bg-paper text-sm text-forest placeholder:text-ink-30 resize-none focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim() || send.isPending}
                aria-label="Send message"
                className="h-11 w-11 self-end flex items-center justify-center rounded-full bg-green text-white hover:bg-forest disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </ClientAppShell>
  );
}
