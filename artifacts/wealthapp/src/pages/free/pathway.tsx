import { useQuery, useMutation } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { CheckCircle, Circle, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Step { stepNumber: number; stepName: string; status: string; completedAt: string | null; }

const PATHWAY_STEPS = [
  { number: 1, name: "Set Up Your Profile", desc: "Complete your financial profile with currency, country, and risk preferences.", icon: "👤" },
  { number: 2, name: "Budget Baseline", desc: "Record your monthly income and expenses to understand your cash flow.", icon: "💰" },
  { number: 3, name: "Define Your Goals", desc: "Set 1-3 financial goals — retirement, home, emergency fund.", icon: "🎯" },
  { number: 4, name: "Track Net Worth", desc: "Log all your assets and liabilities to know your starting point.", icon: "📊" },
  { number: 5, name: "Build an Emergency Fund", desc: "Calculate and plan your 3-6 month emergency fund target.", icon: "🛡️" },
  { number: 6, name: "Investment Strategy", desc: "Choose your risk profile and define your first investment allocation.", icon: "📈" },
];

export default function PathwayPage() {
  const { data: progress = [], isLoading } = useQuery<Step[]>({
    queryKey: ["pathway"],
    queryFn: () => apiFetch<Step[]>("/pathway"),
  });

  const completeStep = useMutation({
    mutationFn: (stepNumber: number) => {
      const stepName = PATHWAY_STEPS.find(s => s.number === stepNumber)?.name ?? "";
      return apiFetch(`/pathway/${stepNumber}`, { method: "PUT", body: JSON.stringify({ stepName, status: "completed" }) });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pathway"] }); toast.success("Step completed!"); },
  });

  const getStatus = (num: number) => progress.find(s => s.stepNumber === num)?.status ?? "not_started";
  const completedCount = progress.filter(s => s.status === "completed").length;

  if (isLoading) return <AppShell><div className="animate-pulse space-y-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}</div></AppShell>;

  return (
    <AppShell>
      <PageHeader title="My Financial Pathway" subtitle="Follow these 6 steps to build a solid financial foundation." />

      <div className="mb-6 bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-sm text-muted-foreground">{completedCount} / {PATHWAY_STEPS.length} steps</span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${(completedCount / PATHWAY_STEPS.length) * 100}%` }} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{Math.round((completedCount / PATHWAY_STEPS.length) * 100)}% complete</div>
      </div>

      <div className="space-y-4">
        {PATHWAY_STEPS.map((step, idx) => {
          const status = getStatus(step.number);
          const isCompleted = status === "completed";
          const isLocked = idx > 0 && getStatus(step.number - 1) !== "completed";
          const isActive = !isLocked && !isCompleted;

          return (
            <div key={step.number} className={cn(
              "bg-card border rounded-xl p-5 flex items-center gap-4 transition-all",
              isCompleted && "border-primary/30 bg-primary/5",
              isActive && "border-card-border shadow-sm",
              isLocked && "border-border opacity-60"
            )}>
              <div className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center text-xl shrink-0",
                isCompleted ? "bg-primary/15" : isLocked ? "bg-muted" : "bg-accent"
              )}>
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Step {step.number}</span>
                  {isCompleted && <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">Done</span>}
                </div>
                <div className="font-semibold mt-0.5">{step.name}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{step.desc}</div>
              </div>
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle className="h-6 w-6 text-primary" />
                ) : isLocked ? (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Button size="sm" onClick={() => completeStep.mutate(step.number)} disabled={completeStep.isPending}>
                    Mark Done <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {completedCount === PATHWAY_STEPS.length && (
        <div className="mt-6 bg-gradient-to-r from-primary to-green-600 rounded-xl p-6 text-white text-center">
          <div className="text-3xl mb-2">🎉</div>
          <h3 className="font-bold text-lg">Pathway Complete!</h3>
          <p className="text-white/80 text-sm mt-2">You've built a solid financial foundation. Consider upgrading to an investment client for personalized portfolio management.</p>
        </div>
      )}
    </AppShell>
  );
}
