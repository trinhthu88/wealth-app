import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Target, FileText, ClipboardList } from "lucide-react";

interface Holding { id: string; assetName: string; assetClass: string; currentValueUsd: string; weightPercent: string | null; }
interface Goal { id: string; title: string; goalType: string; status: string; targetAmount: string | null; currentAmount: string | null; }
interface Task { id: string; title: string; priority: string; status: string; dueDate: string | null; }
interface KycDoc { id: string; documentType: string; status: string; fileName: string | null; createdAt: string; }

export default function AdvisorClientDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: holdings = [] } = useQuery<Holding[]>({ queryKey: ["client-portfolio", id], queryFn: () => apiFetch<Holding[]>(`/advisor/clients/${id}/portfolio`), enabled: !!id });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["client-goals", id], queryFn: () => apiFetch<Goal[]>(`/advisor/clients/${id}/goals`), enabled: !!id });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["client-tasks", id], queryFn: () => apiFetch<Task[]>(`/advisor/clients/${id}/tasks`), enabled: !!id });
  const { data: kycdocs = [] } = useQuery<KycDoc[]>({ queryKey: ["client-kyc", id], queryFn: () => apiFetch<KycDoc[]>(`/advisor/clients/${id}/kyc`), enabled: !!id });

  const portfolioValue = holdings.reduce((s, h) => s + parseFloat(h.currentValueUsd), 0);

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/advisor/clients">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to clients
          </a>
        </Link>
      </div>
      <PageHeader title="Client Detail" subtitle={`Client ID: ${id}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <BarChart3 className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="font-bold text-lg">${portfolioValue.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Portfolio Value</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <Target className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="font-bold text-lg">{goals.length}</div>
          <div className="text-xs text-muted-foreground">Goals</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <ClipboardList className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="font-bold text-lg">{tasks.length}</div>
          <div className="text-xs text-muted-foreground">Tasks</div>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 text-center">
          <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="font-bold text-lg">{kycdocs.length}</div>
          <div className="text-xs text-muted-foreground">KYC Docs</div>
        </div>
      </div>

      <Tabs defaultValue="portfolio">
        <TabsList className="mb-4">
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio">
          {holdings.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No holdings yet.</p> : (
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50"><tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Class</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Weight</th>
                </tr></thead>
                <tbody>{holdings.map(h => (
                  <tr key={h.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{h.assetName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{h.assetClass}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">${parseFloat(h.currentValueUsd).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{h.weightPercent ? `${h.weightPercent}%` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals">
          {goals.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No goals yet.</p> : (
            <div className="space-y-3">{goals.map(g => {
              const prog = g.targetAmount && g.currentAmount ? (parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100 : 0;
              return (
                <div key={g.id} className="bg-card border border-card-border rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-xs text-muted-foreground capitalize">{g.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full">
                    <div className="h-1.5 bg-primary rounded-full" style={{ width: `${Math.min(100, prog)}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{Math.round(prog)}% of target</div>
                </div>
              );
            })}</div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No tasks for this client.</p> : (
            <div className="space-y-2">{tasks.map(t => (
              <div key={t.id} className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{t.title}</div>
                  {t.dueDate && <div className="text-xs text-muted-foreground">Due: {new Date(t.dueDate).toLocaleDateString()}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.priority === "high" ? "bg-red-100 text-red-700" : t.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{t.priority}</span>
                  <span className="text-xs text-muted-foreground">{t.status}</span>
                </div>
              </div>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="kyc">
          {kycdocs.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No KYC documents submitted.</p> : (
            <div className="space-y-2">{kycdocs.map(d => (
              <div key={d.id} className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm capitalize">{d.documentType.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{d.fileName ?? ""} · {new Date(d.createdAt).toLocaleDateString()}</div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${d.status === "approved" ? "bg-green-100 text-green-700" : d.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {d.status}
                </span>
              </div>
            ))}</div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
