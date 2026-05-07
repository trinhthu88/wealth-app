import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useProfile } from "@/hooks/useProfile";
import { MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Conversation { id: string; clientId: string; advisorId: string; lastMessageAt: string | null; }
interface Message { id: string; senderId: string; senderRole: string | null; content: string; createdAt: string; }

export default function ClientMessages() {
  const { profile } = useProfile();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: convs = [] } = useQuery<Conversation[]>({ queryKey: ["conversations"], queryFn: () => apiFetch<Conversation[]>("/conversations") });
  const activeConv = convs.find(c => c.id === activeConvId) ?? convs[0];

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["messages", activeConv?.id],
    queryFn: () => apiFetch<Message[]>(`/conversations/${activeConv!.id}/messages`),
    enabled: !!activeConv,
    refetchInterval: 5000,
  });

  const send = useMutation({
    mutationFn: (content: string) => apiFetch(`/conversations/${activeConv!.id}/messages`, { method: "POST", body: JSON.stringify({ content, senderRole: profile?.role }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["messages", activeConv?.id] }); setMsg(""); },
    onError: () => toast.error("Failed to send"),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const conv = activeConv ?? convs[0];

  return (
    <AppShell>
      <PageHeader title="Messages" subtitle="Communicate with your advisor." />

      {convs.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <MessageSquare className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">No Conversations Yet</h3>
          <p className="text-muted-foreground text-sm">Your advisor will initiate a conversation with you.</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden flex flex-col h-[520px]">
          <div className="border-b border-border px-4 py-3 font-medium text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Conversation with Advisor
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && <p className="text-center text-sm text-muted-foreground pt-8">No messages yet. Start the conversation!</p>}
            {messages.map(m => {
              const isMe = m.senderId === profile?.id;
              return (
                <div key={m.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-xs md:max-w-md px-4 py-2.5 rounded-2xl text-sm", isMe ? "bg-primary text-white rounded-br-sm" : "bg-muted rounded-bl-sm")}>
                    <p>{m.content}</p>
                    <p className={cn("text-xs mt-1", isMe ? "text-white/70" : "text-muted-foreground")}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border p-3 flex gap-2">
            <Input placeholder="Type a message…" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && !send.isPending && msg.trim() && send.mutate(msg.trim())} />
            <Button onClick={() => msg.trim() && send.mutate(msg.trim())} disabled={!msg.trim() || send.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
