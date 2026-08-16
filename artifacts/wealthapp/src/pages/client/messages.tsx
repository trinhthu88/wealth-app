import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ClientAppShell from "@/components/client/AppShell";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useProfile } from "@/hooks/useProfile";
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

  // Fix 3: send only content, no role in body
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

  // Fix 5: "Ask about [holding]" pre-fill from URL param
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

  return (
    <ClientAppShell>
      {/* Fix 2: h-full flex col so inner flex-1 works */}
      <div className="h-full flex flex-col max-w-[860px] mx-auto">
        <h1 className="text-xl font-bold text-[#042C53] mb-4 shrink-0">Messages</h1>

        {convs.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center flex flex-col items-center gap-4">
            <Sol size="lg" animate="float" showFace />
            <div>
              <h3 className="font-semibold mb-1 text-[#042C53]">No messages yet</h3>
              <p className="text-slate-500 text-sm">Send your advisor a message to get started.</p>
            </div>
          </div>
        ) : (
          /* Fix 2: flex-1 min-h-0 replaces h-[520px] */
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="border-b border-[#E2E8F0] px-4 py-3 font-medium text-sm flex items-center gap-2 shrink-0">
              <MessageSquare className="h-4 w-4 text-[#1D9E75]" />
              <span className="text-[#042C53]">Conversation with your advisor</span>
            </div>

            {/* Fix 1: role="log" aria-live="polite" + Fix 2: flex-1 min-h-0 */}
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation with your advisor"
              aria-atomic="false"
              aria-relevant="additions"
              className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
            >
              {messages.length === 0 && (
                <p className="text-center text-sm text-slate-400 pt-8">
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
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-xs text-slate-400 shrink-0">
                        {dateKey !== "Unknown" ? formatDateSeparator(dateKey) : ""}
                      </span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                    {dayMessages.map(m => {
                      const isMe = m.senderId === profile?.id;
                      const timestamp = m.sentAt ?? m.createdAt ?? "";
                      return (
                        <div key={m.id} className={cn("flex mb-2", isMe ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-xs md:max-w-md px-4 py-2.5 rounded-2xl text-sm",
                            isMe
                              ? "bg-[#1D9E75] text-white rounded-br-sm"
                              : "bg-slate-100 text-[#042C53] rounded-bl-sm"
                          )}>
                            <p>{m.content}</p>
                            <p className={cn("text-xs mt-1", isMe ? "text-white/70" : "text-slate-400")}>
                              {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}

              {/* Fix 4: typing indicator (local feedback when user is composing) */}
              {isTyping && (
                <div
                  role="status"
                  aria-label="Composing message"
                  className="flex items-center gap-1 px-3 py-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:300ms]" />
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-[#E2E8F0] p-3 flex gap-2 shrink-0">
              <textarea
                ref={textareaRef}
                placeholder="Type a message…"
                value={msg}
                onChange={handleInputChange}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
              />
              <button
                onClick={handleSend}
                disabled={!msg.trim() || send.isPending}
                aria-label="Send message"
                className="h-10 w-10 self-end flex items-center justify-center rounded-xl bg-[#1D9E75] text-white hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
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
