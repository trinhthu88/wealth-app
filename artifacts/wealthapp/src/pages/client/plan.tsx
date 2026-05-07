import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { ClipboardList, CheckCircle, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan { id: string; title: string; status: string; nextReviewDate: string | null; planData: unknown; updatedAt: string; }
interface Milestone { id: string; title: string; status: string; targetDate: string | null; notes: string | null; }

export default function ClientPlan() {
  const { data: plans = [], isLoading } = useQuery<Plan[]>({ queryKey: ["plans"], queryFn: () => apiFetch<Plan[]>("/plans") });
  const plan = plans[0];

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: ["milestones", plan?.id],
    queryFn: () => apiFetch<Milestone[]>(`/plans/${plan!.id}/milestones`),
    enabled: !!plan,
  });

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    active: { label: "Active", color: "bg-primary/10 text-primary" },
    completed: { label: "Completed", color: "bg-green-100 text-green-700" },
    archived: { label: "Archived", color: "bg-muted text-muted-foreground" },
  };

  if (isLoading) return <AppShell><div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-xl" /><div className="h-64 bg-muted rounded-xl" /></div></AppShell>;

  return (
    <AppShell>
      <PageHeader title="My Financial Plan" subtitle="Your personalized roadmap, managed by your advisor." />

      {!plan ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <ClipboardList className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Financial Plan Yet</h3>
          <p className="text-muted-foreground text-sm">Your advisor will create a personalized financial plan for you.</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold">{plan.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", STATUS_MAP[plan.status]?.color ?? "bg-muted text-muted-foreground")}>
                    {STATUS_MAP[plan.status]?.label ?? plan.status}
                  </span>
                  {plan.nextReviewDate && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Next review: {new Date(plan.nextReviewDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Updated {new Date(plan.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Milestones</h3>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No milestones defined yet.</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((m, i) => (
                  <div key={m.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {m.status === "completed" ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("font-medium text-sm", m.status === "completed" && "line-through text-muted-foreground")}>{m.title}</div>
                      <div className="flex gap-2 mt-0.5">
                        {m.targetDate && <span className="text-xs text-muted-foreground">{new Date(m.targetDate).toLocaleDateString()}</span>}
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", m.status === "completed" ? "bg-primary/10 text-primary" : m.status === "in_progress" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>{m.status}</span>
                      </div>
                      {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
