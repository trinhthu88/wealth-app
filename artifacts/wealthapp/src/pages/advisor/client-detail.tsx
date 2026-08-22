import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, Save, MessageCircle, TrendingUp, FileText } from "lucide-react";
import { fmtCurrency } from "@/lib/portfolioCalculations";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AdvisedPlanManager from "@/components/advisor/AdvisedPlanManager";
import DocumentsManager from "@/components/advisor/DocumentsManager";

interface ClientProfile {
  id: string;
  userId: string;
  status: string;
  kycStatus: string;
  riskProfile: string | null;
  riskScore: number | null;
  investmentStyle: string | null;
  indicativeAmount: string | null;
  preCallNotes: string | null;
  advisorInternalNotes: string | null;
  prospectOnboardingComplete: boolean;
  fullOnboardingComplete: boolean;
  onboardingStep: number;
}

interface ClientUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

interface Goal {
  id: string;
  title: string;
  goalType: string;
  status: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate: string | null;
}

interface Task { id: string; title: string; priority: string; status: string; dueDate: string | null; }

interface AdvisedPlanSummary { id: string; status: string; latestAccountValue: string; }

interface Conversation { id: string; clientId: string; advisorId: string; }
interface Message { id: string; senderId: string; senderRole: string | null; content: string; createdAt: string; }

// Only active | paused | churned belong on an already-promoted client's
// account-health status now — see clients.ts's clientProfilesTable comment.
const STATUS_OPTIONS = ["active", "paused", "churned"];
const KYC_OPTIONS = ["not_started", "submitted", "approved", "rejected"];

export default function AdvisorClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile: advisorProfile } = useProfile();
  const advisorId = advisorProfile?.id;

  const { data: profile } = useQuery<ClientUser>({
    queryKey: ["advisor-client-profile", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/profile`),
    enabled: !!id,
  });

  const { data: clientProfile, refetch: refetchCP } = useQuery<ClientProfile>({
    queryKey: ["advisor-client-cp", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/client-profile`),
    enabled: !!id,
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["advisor-client-goals", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/goals`),
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["advisor-client-tasks", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/tasks`),
    enabled: !!id,
  });

  // Same queryKey AdvisedPlanManager uses internally, so the two share one
  // cached fetch instead of loading the client's plans twice.
  const { data: plans = [] } = useQuery<AdvisedPlanSummary[]>({
    queryKey: ["advisor-client-plans", id],
    queryFn: () => apiFetch(`/advisor/clients/${id}/advised-plans`),
    enabled: !!id,
  });

  // ── Messaging ─────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState("investment-plans");
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversation", id, advisorId],
    queryFn: () => apiFetch<Conversation[]>(`/conversations?clientId=${id}&advisorId=${advisorId}`),
    enabled: !!id && !!advisorId && activeTab === "messages",
  });

  const conversation = conversations[0] ?? null;

  const { data: messages = [], refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: ["messages", conversation?.id],
    queryFn: () => apiFetch<Message[]>(`/conversations/${conversation!.id}/messages`),
    enabled: !!conversation,
    refetchInterval: activeTab === "messages" ? 3000 : false,
  });

  useEffect(() => {
    if (activeTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const sendMsgMut = useMutation({
    mutationFn: (content: string) => apiFetch(`/conversations/${conversation!.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, senderRole: "advisor" }),
    }),
    onSuccess: () => { setMessageInput(""); refetchMessages(); },
    onError: () => toast.error("Failed to send message"),
  });

  const handleSend = () => {
    const trimmed = messageInput.trim();
    if (!trimmed || !conversation) return;
    sendMsgMut.mutate(trimmed);
  };

  // ── Other mutations ───────────────────────────────────────────────────────

  const totalValue = plans.reduce((s, p) => s + parseFloat(p.latestAccountValue ?? "0"), 0);

  const updateCPMut = useMutation({
    mutationFn: (data: any) => apiFetch(`/advisor/clients/${id}/client-profile`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { refetchCP(); toast.success("Updated"); },
  });

  const [internalNotes, setInternalNotes] = useState(clientProfile?.advisorInternalNotes ?? "");

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/advisor/clients" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-40 hover:text-forest transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[32px] font-semibold text-forest leading-none mb-2">{profile?.fullName ?? "Client"}</h1>
          <p className="text-[14px] text-ink-60">{profile?.email}</p>
        </div>
        <span className={cn("text-[12px] px-3 py-1 rounded-[8px] font-medium tracking-wide uppercase",
          clientProfile?.status === "active" ? "bg-green-tint text-green" :
          clientProfile?.status === "churned" ? "bg-clay-tint text-clay-ink" : "bg-surface border border-hairline text-ink-60")}>
          {clientProfile?.status?.replace(/_/g, " ") ?? "—"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none mb-1">{fmtCurrency(totalValue)}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">Portfolio</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none mb-1">{plans.length}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">Plans</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[24px] font-semibold text-forest tabular-nums leading-none mb-1">{goals.length}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">Goals</div>
        </div>
        <div className="bg-surface border border-hairline rounded-[26px] p-5 text-center shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
          <div className="font-display text-[20px] font-semibold text-forest leading-none mb-1">{clientProfile?.kycStatus?.replace(/_/g, " ") ?? "—"}</div>
          <div className="text-[12px] text-ink-40 tracking-wide uppercase">KYC</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-surface border border-hairline rounded-full p-1 w-full justify-start h-auto flex-wrap overflow-x-auto gap-1">
          <TabsTrigger value="profile" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Profile</TabsTrigger>
          <TabsTrigger value="goals" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Goals</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">Tasks</TabsTrigger>
          <TabsTrigger value="messages" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <MessageCircle className="h-4 w-4 mr-1.5 inline-block" />Messages
          </TabsTrigger>
          <TabsTrigger value="investment-plans" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <TrendingUp className="h-4 w-4 mr-1.5 inline-block" />Plans
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-full px-4 py-2 text-[13px] font-medium data-[state=active]:bg-forest data-[state=active]:text-paper data-[state=active]:shadow-none transition-colors">
            <FileText className="h-4 w-4 mr-1.5 inline-block" />Documents
          </TabsTrigger>
        </TabsList>

        {/* ── Profile ── */}
        <TabsContent value="profile">
          {clientProfile && (
            <div className="space-y-6">
              <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)] space-y-5">
                <h3 className="font-display text-[20px] font-semibold text-forest">Client Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Status</label>
                    <select className="w-full h-11 border border-hairline rounded-[12px] bg-paper px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize"
                      value={clientProfile.status}
                      onChange={(e) => updateCPMut.mutate({ status: e.target.value })}>
                      {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">Risk Profile</label>
                    <select className="w-full h-11 border border-hairline rounded-[12px] bg-paper px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize"
                      value={clientProfile.riskProfile ?? ""}
                      onChange={(e) => updateCPMut.mutate({ riskProfile: e.target.value || null })}>
                      <option value="">Unknown</option>
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="balanced">Balanced</option>
                      <option value="growth">Growth</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-ink-60 block mb-1.5">KYC status</label>
                    <select className="w-full h-11 border border-hairline rounded-[12px] bg-paper px-4 text-[14px] text-forest focus:outline-none focus:ring-2 focus:ring-green capitalize"
                      value={clientProfile.kycStatus ?? "not_started"}
                      onChange={(e) => updateCPMut.mutate({ kycStatus: e.target.value })}>
                      {KYC_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                    </select>
                    <p className="text-[12px] text-ink-40 mt-1.5">A manual note, not a verification — actual KYC happens on the external investment platform.</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.04)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[20px] font-semibold text-forest">Advisor Internal Notes</h3>
                  <Button size="sm" className="rounded-full h-9 px-4 bg-green text-surface hover:bg-green-300"
                    onClick={() => updateCPMut.mutate({ advisorInternalNotes: internalNotes })}
                    disabled={updateCPMut.isPending || internalNotes === clientProfile.advisorInternalNotes}>
                    <Save className="h-4 w-4 mr-2" /> Save Notes
                  </Button>
                </div>
                <Textarea
                  className="w-full rounded-[16px] border-hairline bg-paper px-5 py-4 text-[14px] text-forest focus-visible:ring-green min-h-[150px] resize-y"
                  placeholder="Private notes (not visible to client)…"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </div>

              {clientProfile.preCallNotes && (
                <div className="bg-paper border border-hairline rounded-[26px] p-6 space-y-3">
                  <h3 className="font-semibold text-forest text-[15px]">Pre-call Notes (from prospect form)</h3>
                  <div className="text-[14px] text-ink-60 whitespace-pre-wrap">{clientProfile.preCallNotes}</div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Goals ── */}
        <TabsContent value="goals">
          {goals.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">No goals found.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map((g) => (
                <div key={g.id} className="bg-surface border border-hairline rounded-[26px] p-6 shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-display text-[20px] font-semibold text-forest mb-1">{g.title}</h4>
                      <p className="text-[13px] text-ink-40 tracking-wide uppercase capitalize">{g.goalType.replace(/_/g, " ")}</p>
                    </div>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", g.status === "completed" ? "bg-green-tint text-green" : g.status === "in_progress" ? "bg-sun-tint text-amber-ink" : "bg-surface border border-hairline text-ink-60")}>
                      {g.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {g.targetAmount && (
                    <div className="mt-4 pt-4 border-t border-hairline">
                      <div className="flex justify-between text-[13px] mb-2">
                        <span className="text-ink-60">Progress</span>
                        <span className="font-medium text-forest tabular-nums">{fmtCurrency(parseFloat(g.currentAmount || "0"))} / {fmtCurrency(parseFloat(g.targetAmount))}</span>
                      </div>
                      <div className="h-2 w-full bg-paper rounded-full overflow-hidden">
                        <div className="h-full bg-green rounded-full"
                          style={{ width: `${Math.min(100, (parseFloat(g.currentAmount || "0") / parseFloat(g.targetAmount)) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {g.targetDate && (
                    <p className="text-[13px] text-ink-40 mt-4 tabular-nums">Target: {new Date(g.targetDate).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tasks ── */}
        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] text-[14px] text-ink-40">No tasks for this client.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="bg-surface border border-hairline rounded-[20px] p-5 flex items-center justify-between shadow-[0_2px_14px_rgba(20,52,42,0.04)]">
                  <div>
                    <h4 className={cn("font-medium text-[16px]", t.status === "completed" ? "text-ink-40 line-through" : "text-forest")}>{t.title}</h4>
                    {t.dueDate && <p className="text-[13px] text-ink-40 mt-1 tabular-nums">Due: {new Date(t.dueDate).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", t.priority === "high" ? "bg-clay-tint text-clay" : t.priority === "medium" ? "bg-sun-tint text-amber-ink" : "bg-surface border border-hairline text-ink-60")}>
                      {t.priority}
                    </span>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-[4px] font-medium tracking-wide uppercase", t.status === "completed" ? "bg-green-tint text-green" : "bg-surface border border-hairline text-ink-60")}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Messages ── */}
        <TabsContent value="messages">
          <div className="flex flex-col h-[600px] border border-hairline rounded-[26px] bg-surface overflow-hidden shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
            <div className="p-4 border-b border-hairline bg-paper flex items-center gap-3 shrink-0">
              <div className="h-10 w-10 rounded-full bg-sun-tint flex items-center justify-center text-amber-ink font-bold text-[15px]">
                {profile?.fullName?.[0]?.toUpperCase() ?? "C"}
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-forest">{profile?.fullName ?? "Client"}</h3>
                <p className="text-[12px] text-ink-40">Direct chat</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[14px] text-ink-40">No messages yet. Start the conversation.</div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderRole === "advisor";
                  return (
                    <div key={m.id} className={cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "items-start")}>
                      <div className={cn("px-5 py-3 rounded-[20px] text-[15px] leading-relaxed shadow-sm",
                        isMe ? "bg-forest text-paper rounded-br-[4px]" : "bg-paper border border-hairline text-forest rounded-bl-[4px]")}>
                        {m.content}
                      </div>
                      <span className="text-[11px] text-ink-40 mt-1.5 tabular-nums px-1">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        </TabsContent>

        {/* ── Investment Plans ── */}
        <TabsContent value="investment-plans">
          <AdvisedPlanManager clientId={id} />
        </TabsContent>

        {/* ── Documents (replaces the old KYC tab's verify/reject workflow —
             kyc-category documents live here now, no separate approval state) ── */}
        <TabsContent value="documents">
          <DocumentsManager basePath={`/advisor/clients/${id}`} enabled={activeTab === "documents"} />
        </TabsContent>

      </Tabs>
    </AppShell>
  );
}
