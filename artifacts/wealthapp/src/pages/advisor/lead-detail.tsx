import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, MessageCircle, TrendingUp, FileText, Save } from "lucide-react";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AdvisedPlanManager from "@/components/advisor/AdvisedPlanManager";
import DocumentsManager from "@/components/advisor/DocumentsManager";

interface Lead {
  id: string;
  email: string;
  firstName: string | null;
  source: string | null;
  healthScore: number | null;
  status: string;
  assignedAdvisorId: string | null;
  userId: string | null;
  notes: string | null;
  convertedUserId: string | null;
  createdAt: string;
}

interface Goal {
  id: string; title: string; goalType: string; status: string;
  targetAmount: string | null; currentAmount: string | null; targetDate: string | null;
}
interface Asset { id: string; name: string; category: string; valueUsd: string; }
interface Liability { id: string; name: string; category: string; balanceUsd: string; }
interface Holding { id: string; label: string; holdingType: string; currentValue?: number; }
interface Conversation { id: string; clientId: string; advisorId: string; }
interface Message { id: string; senderId: string; senderRole: string | null; content: string; createdAt: string; }

// unassigned (default) → active → cold | churned | client — see leads.ts's
// schema comment for the full model. Same palette as advisor/leads.tsx.
const STATUS_COLORS: Record<string, string> = {
  unassigned: "bg-sun-tint text-amber-ink",
  active: "bg-green-tint text-green",
  cold: "bg-surface border border-hairline text-ink-60",
  churned: "bg-clay-tint text-clay-ink",
  client: "bg-forest text-paper",
};
const STATUS_OPTIONS = ["unassigned", "active", "cold", "churned", "client"];

export default function AdvisorLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile: advisorProfile } = useProfile();
  const advisorId = advisorProfile?.id;

  const [activeTab, setActiveTab] = useState("overview");

  const { data: lead, refetch: refetchLead } = useQuery<Lead>({
    queryKey: ["advisor-lead", id],
    queryFn: () => apiFetch(`/leads/${id}`),
    enabled: !!id,
  });

  const leadUserId = lead?.userId ?? null;
  const hasAccount = !!leadUserId;

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["advisor-lead-goals", leadUserId],
    queryFn: () => apiFetch(`/advisor/leads/${leadUserId}/goals`),
    enabled: hasAccount,
  });

  const { data: netWorth } = useQuery<{ assets: Asset[]; liabilities: Liability[] }>({
    queryKey: ["advisor-lead-networth", leadUserId],
    queryFn: () => apiFetch(`/advisor/leads/${leadUserId}/networth`),
    enabled: hasAccount,
  });

  const { data: holdings = [] } = useQuery<Holding[]>({
    queryKey: ["advisor-lead-holdings", leadUserId],
    queryFn: () => apiFetch(`/advisor/leads/${leadUserId}/holdings`),
    enabled: hasAccount,
  });

  // ── Messaging (same find-or-create pattern as client-detail.tsx) ─────────
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversation", leadUserId, advisorId],
    queryFn: () => apiFetch<Conversation[]>(`/conversations?clientId=${leadUserId}&advisorId=${advisorId}`),
    enabled: hasAccount && !!advisorId && activeTab === "messages",
  });
  const conversation = conversations[0] ?? null;

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["messages", conversation?.id],
    queryFn: () => apiFetch<Message[]>(`/conversations/${conversation!.id}/messages`),
    enabled: !!conversation,
    refetchInterval: activeTab === "messages" ? 3000 : false,
  });

  useEffect(() => {
    if (activeTab === "messages") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const sendMsgMut = useMutation({
    mutationFn: (content: string) => apiFetch(`/conversations/${conversation!.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, senderRole: "advisor" }),
    }),
    onSuccess: () => { setMessageInput(""); refetchMessages(); },
    onError: () => toast.error("Failed to send message"),
  });

  function handleSend() {
    const trimmed = messageInput.trim();
    if (!trimmed || !conversation) return;
    sendMsgMut.mutate(trimmed);
  }

  // ── Profile (status + notes) ──────────────────────────────────────────────
  const [notesDraft, setNotesDraft] = useState(lead?.notes ?? "");
  useEffect(() => { setNotesDraft(lead?.notes ?? ""); }, [lead?.notes]);

  const updateLeadMut = useMutation({
    mutationFn: (data: { status?: string; notes?: string }) => apiFetch(`/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { refetchLead(); toast.success("Updated"); },
    // Surface the server's message — a blocked promotion (no linked account,
    // no assigned advisor) has a specific reason worth showing, not just "failed".
    onError: (e: any) => toast.error(e?.message ?? "Failed to update"),
  });

  // Setting status to "client" triggers a real promotion (role flip +
  // client_profiles creation) — confirm before firing it, same as the
  // "Mark in-force" prompt in AdvisedPlanManager.
  function handleStatusChange(newStatus: string) {
    if (newStatus === "client" && lead?.status !== "client") {
      const ok = confirm("This promotes the lead to a full investment client: flips their account role and creates their client profile. Continue?");
      if (!ok) return;
    }
    updateLeadMut.mutate({ status: newStatus });
  }

  const totalAssets = (netWorth?.assets ?? []).reduce((s, a) => s + (parseFloat(a.valueUsd) || 0), 0);
  const totalLiabilities = (netWorth?.liabilities ?? []).reduce((s, l) => s + (parseFloat(l.balanceUsd) || 0), 0);

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/advisor/leads" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-40 hover:text-forest transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-forest leading-none mb-2">{lead?.firstName ?? "Lead"}</h1>
          <p className="text-[14px] text-ink-60">{lead?.email}</p>
        </div>
        <span className={cn("text-[12px] px-3 py-1 rounded-[8px] font-medium tracking-wide uppercase", STATUS_COLORS[lead?.status ?? "unassigned"])}>
          {lead?.status ?? "—"}
        </span>
      </div>

      {!hasAccount && lead && (
        <div className="mb-6 bg-sun-tint border border-[#FBE5C5] rounded-[20px] p-4 text-[13px] text-amber-ink">
          This lead came from the anonymous quiz funnel and isn't linked to an account yet — Goals, Net Worth,
          Self-holdings, Messages, and Plans aren't available until it is.
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-surface border border-hairline rounded-full p-1 w-full justify-start h-auto flex-wrap overflow-x-auto gap-1">
          <TabsTrigger value="overview" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Overview</TabsTrigger>
          <TabsTrigger value="messages" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <MessageCircle className="h-4 w-4 mr-1.5 inline-block" />Messages
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <FileText className="h-4 w-4 mr-1.5 inline-block" />Documents
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Profile</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <TrendingUp className="h-4 w-4 mr-1.5 inline-block" />Plans
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          {!hasAccount ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">
              Nothing to show yet for an unlinked lead.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
                  <h3 className="font-display text-[18px] font-semibold text-forest mb-4">Net worth</h3>
                  <div className="flex justify-between text-[14px] mb-2"><span className="text-ink-60">Assets</span><span className="font-semibold text-forest tabular-nums">{fmtCurrency(totalAssets)}</span></div>
                  <div className="flex justify-between text-[14px] mb-2"><span className="text-ink-60">Liabilities</span><span className="font-semibold text-clay tabular-nums">{fmtCurrency(totalLiabilities)}</span></div>
                  <div className="flex justify-between text-[15px] pt-2 border-t border-hairline"><span className="font-semibold text-forest">Net</span><span className="font-semibold text-forest tabular-nums">{fmtCurrency(totalAssets - totalLiabilities)}</span></div>
                </div>
                <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
                  <h3 className="font-display text-[18px] font-semibold text-forest mb-4">Self-held holdings</h3>
                  {holdings.length === 0 ? (
                    <p className="text-[14px] text-ink-40">None recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {holdings.map(h => (
                        <div key={h.id} className="flex justify-between text-[14px]">
                          <span className="text-forest">{h.label}</span>
                          <span className="text-ink-40 capitalize">{h.holdingType.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-display text-[18px] font-semibold text-forest mb-4">Goals</h3>
                {goals.length === 0 ? (
                  <div className="text-center py-12 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">No goals found.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {goals.map(g => (
                      <div key={g.id} className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
                        <h4 className="font-display text-[18px] font-semibold text-forest mb-1">{g.title}</h4>
                        <p className="text-[13px] text-ink-40 tracking-wide uppercase capitalize">{g.goalType.replace(/_/g, " ")}</p>
                        {g.targetAmount && (
                          <div className="mt-4 pt-4 border-t border-hairline flex justify-between text-[13px]">
                            <span className="text-ink-60">Progress</span>
                            <span className="font-medium text-forest tabular-nums">{fmtCurrency(parseFloat(g.currentAmount || "0"))} / {fmtCurrency(parseFloat(g.targetAmount))}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Messages ── */}
        <TabsContent value="messages">
          {!hasAccount ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">
              Messaging isn't available until this lead is linked to an account.
            </div>
          ) : (
            <div className="flex flex-col h-[600px] border border-hairline rounded-[26px] bg-surface overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
              <div className="p-4 border-b border-hairline bg-paper flex items-center gap-3 shrink-0">
                <div className="h-10 w-10 rounded-full bg-sun-tint flex items-center justify-center text-amber-ink font-bold text-[15px]">
                  {(lead?.firstName ?? lead?.email)?.[0]?.toUpperCase() ?? "L"}
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] text-forest">{lead?.firstName ?? lead?.email}</h3>
                  <p className="text-[12px] text-ink-40">Direct chat</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[14px] text-ink-40">No messages yet. Start the conversation.</div>
                ) : (
                  messages.map(m => {
                    const isMe = m.senderRole === "advisor";
                    return (
                      <div key={m.id} className={cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "items-start")}>
                        <div className={cn("px-5 py-3 rounded-[20px] text-[15px] leading-relaxed shadow-sm",
                          isMe ? "bg-forest text-paper rounded-br-[4px]" : "bg-paper border border-hairline text-forest rounded-bl-[4px]")}>
                          {m.content}
                        </div>
                        <span className="text-[11px] text-ink-40 mt-1.5 tabular-nums px-1">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-hairline bg-paper shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3">
                  <Input
                    className="flex-1 h-12 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green text-[15px]"
                    placeholder="Type a message…"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                  />
                  <Button type="submit" disabled={!messageInput.trim() || sendMsgMut.isPending} className="h-12 w-12 rounded-full p-0 bg-green text-surface hover:bg-green-300 shrink-0 shadow-md">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents">
          {!hasAccount ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">
              Documents aren't available until this lead is linked to an account.
            </div>
          ) : (
            <DocumentsManager basePath={`/advisor/leads/${leadUserId}`} enabled={activeTab === "documents"} />
          )}
        </TabsContent>

        {/* ── Profile ── */}
        <TabsContent value="profile">
          {lead && (
            <div className="space-y-6">
              <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)] space-y-5">
                <h3 className="font-display text-[20px] font-semibold text-forest">Relationship status</h3>
                <select
                  className="w-64 h-11 border border-hairline rounded-[12px] bg-paper px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize"
                  value={lead.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {lead.convertedUserId && (
                  <p className="text-[13px] text-green">Promoted — this lead now has a full investment_client account.</p>
                )}
              </div>

              <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[20px] font-semibold text-forest">Internal notes</h3>
                  <Button size="sm" className="rounded-full h-9 px-4 bg-green text-surface hover:bg-green-300"
                    onClick={() => updateLeadMut.mutate({ notes: notesDraft })}
                    disabled={updateLeadMut.isPending || notesDraft === (lead.notes ?? "")}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                </div>
                <Textarea
                  className="w-full rounded-[16px] border-hairline bg-paper px-5 py-4 text-[14px] text-forest focus-visible:ring-green min-h-[150px] resize-y"
                  placeholder="Private notes (not visible to this lead)…"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                />
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Plans ── */}
        <TabsContent value="plans">
          {!hasAccount ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">
              Plans aren't available until this lead is linked to an account.
            </div>
          ) : (
            <AdvisedPlanManager clientId={leadUserId!} />
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
