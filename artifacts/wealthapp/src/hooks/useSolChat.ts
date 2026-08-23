import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export interface SolChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sentAt: string;
}

interface SolConversationResponse {
  conversationId: string | null;
  messages: SolChatMessage[];
}

interface SolChatReplyResponse {
  conversationId: string;
  message: SolChatMessage;
}

/** Loads Sol's most recent conversation for this client once the drawer is
 * open, and sends new messages to the real backend (POST /sol/chat). Every
 * number Sol cites in a reply comes from that backend's own tool calls
 * against real data — this hook only moves text back and forth. */
export function useSolChat(open: boolean) {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const queryKey = ["sol-conversation"];

  const query = useQuery<SolConversationResponse>({
    queryKey,
    queryFn: () => apiFetch<SolConversationResponse>("/sol/conversation"),
    enabled: open && isLoaded && !!user,
  });

  const mutation = useMutation({
    mutationFn: (text: string) => {
      const conversationId = qc.getQueryData<SolConversationResponse>(queryKey)?.conversationId ?? undefined;
      return apiFetch<SolChatReplyResponse>("/sol/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId, message: text }),
      });
    },
    onMutate: (text: string) => {
      const optimisticUser: SolChatMessage = {
        id: `optimistic-${crypto.randomUUID()}`,
        role: "user",
        content: text,
        sentAt: new Date().toISOString(),
      };
      qc.setQueryData<SolConversationResponse>(queryKey, prev => ({
        conversationId: prev?.conversationId ?? null,
        messages: [...(prev?.messages ?? []), optimisticUser],
      }));
    },
    onSuccess: (data) => {
      qc.setQueryData<SolConversationResponse>(queryKey, prev => ({
        conversationId: data.conversationId,
        messages: [...(prev?.messages ?? []), data.message],
      }));
    },
  });

  return {
    messages: query.data?.messages ?? [],
    loading: query.isLoading,
    send: (text: string) => { mutation.reset(); mutation.mutate(text); },
    sending: mutation.isPending,
    sendFailed: mutation.isError,
  };
}
