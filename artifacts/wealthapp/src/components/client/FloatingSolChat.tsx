import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { invalidateEntitlements } from "@/hooks/useEntitlements";
import BottomSheet from "./BottomSheet";
import Sol from "@/components/Sol";
import { cn } from "@/lib/utils";
import { OPEN_SOL_CHAT_EVENT } from "@/lib/solChat";

interface SolMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sentAt: string;
}

interface SolConversation {
  conversationId: string | null;
  messages: SolMessage[];
}

interface SolChatReply {
  conversationId: string;
  message: SolMessage;
}

export default function FloatingSolChat({ isOnboarding = false }: { isOnboarding?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SolMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // The Sol button in the mobile menu bar opens this same sheet.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_SOL_CHAT_EVENT, open);
    return () => window.removeEventListener(OPEN_SOL_CHAT_EVENT, open);
  }, []);

  const conversationQuery = useQuery<SolConversation>({
    queryKey: ["sol-conversation"],
    queryFn: () => apiFetch<SolConversation>("/sol/conversation"),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!conversationQuery.data) return;
    setConversationId(conversationQuery.data.conversationId);
    setMessages(conversationQuery.data.messages);
  }, [conversationQuery.data]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setErrorMessage(null);
    try {
      const reply = await apiFetch<SolChatReply>("/sol/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversationId ?? conversationQuery.data?.conversationId ?? undefined,
          message: content,
        }),
      });
      const userMessage: SolMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content,
        sentAt: new Date().toISOString(),
      };
      const updatedMessages = [...messages, userMessage, reply.message];
      setMessages(updatedMessages);
      setConversationId(reply.conversationId);
      setDraft("");
      invalidateEntitlements(queryClient);
      queryClient.setQueryData<SolConversation>(["sol-conversation"], {
        conversationId: reply.conversationId,
        messages: updatedMessages,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sol is unavailable right now. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open Sol chat"
        title="Chat with Sol"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-20 flex h-14 w-14 items-center justify-center rounded-full border border-green/20 bg-surface shadow-[0_8px_28px_rgba(12,33,164,.22)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2",
          isOnboarding
            ? "top-[calc(env(safe-area-inset-top)+1rem)]"
            : "hidden lg:flex lg:bottom-6",
        )}
        style={{ right: "max(1rem, env(safe-area-inset-right))" }}
      >
        <Sol size="sm" animate="idle" showRays={false} />
      </button>

      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Chat with Sol" height="auto">
        <div className="flex h-[65dvh] max-h-[680px] min-h-[280px] flex-col">
          <div
            className="flex-1 space-y-3 overflow-y-auto pb-4"
            aria-live="polite"
            aria-label="Sol conversation"
          >
            {conversationQuery.isLoading && messages.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-40">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading your conversation…
              </div>
            )}
            {conversationQuery.isError && messages.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-ink-60">Sol’s conversation could not be loaded.</p>
                <button
                  type="button"
                  onClick={() => void conversationQuery.refetch()}
                  className="mt-2 text-sm font-semibold text-green underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}
            {!conversationQuery.isLoading && !conversationQuery.isError && messages.length === 0 && (
              <div className="rounded-2xl bg-green-tint px-4 py-3 text-sm leading-relaxed text-forest">
                Send Sol a message to start.
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "ml-auto bg-forest text-paper"
                    : "mr-auto bg-green-tint text-forest",
                )}
              >
                {message.content}
              </div>
            ))}
            {errorMessage && (
              <p role="alert" className="text-sm text-clay">{errorMessage}</p>
            )}
          </div>

          <form
            onSubmit={(event) => void sendMessage(event)}
            className="flex shrink-0 items-end gap-2 border-t border-hairline pt-3"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <label className="sr-only" htmlFor="sol-chat-message">Message Sol</label>
            <textarea
              id="sol-chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message Sol…"
              rows={2}
              maxLength={4000}
              disabled={isSending}
              className="min-h-11 flex-1 resize-none rounded-2xl border border-hairline bg-paper px-4 py-3 text-sm text-forest outline-none placeholder:text-ink-30 focus:border-green"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim() || isSending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green text-paper transition-colors hover:bg-forest disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </BottomSheet>
    </>
  );
}
