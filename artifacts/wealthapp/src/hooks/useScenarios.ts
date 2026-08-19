import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { runScenario, type ScenarioParams, type ScenarioResult } from "@/lib/investmentCalculations";
import { toast } from "sonner";

export interface ScenarioRun {
  id: string;
  userId: string;
  scenarioName: string | null;
  scenarioType: string;
  sourceType: string | null;
  sourceId: string | null;
  linkedGoalId: string | null;
  parameters: Record<string, unknown>;
  projectionData: Array<{ month: number; label: string; baseline: number; scenario: number }>;
  baselineFinalValue: string | null;
  scenarioFinalValue: string | null;
  deltaValue: string | null;
  deltaPct: string | null;
  isSaved: boolean;
  isAdvisorPushed: boolean;
  alertStatus: string;
  createdAt: string;
}

const MAX_SAVED = 5;

export function useScenarios() {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const enabled = isLoaded && !!user;

  const savedQuery = useQuery<ScenarioRun[]>({
    queryKey: ["scenario-runs", "saved"],
    queryFn: () => apiFetch("/client/scenarios?saved=true"),
    enabled,
  });

  const advisorQuery = useQuery<ScenarioRun[]>({
    queryKey: ["scenario-runs", "advisor"],
    queryFn: () => apiFetch("/client/scenarios?advisor=true"),
    enabled,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ result, name }: { result: ScenarioResult; name: string }) => {
      const saved = savedQuery.data ?? [];
      if (saved.length >= MAX_SAVED) {
        throw new Error("limit");
      }
      return apiFetch("/client/scenarios", {
        method: "POST",
        body: JSON.stringify({
          scenarioName: name,
          scenarioType: result.params.type,
          parameters: result.params,
          projectionData: result.dataPoints,
          baselineFinalValue: result.baselineFinalValue,
          scenarioFinalValue: result.scenarioFinalValue,
          deltaValue: result.deltaValue,
          deltaPct: result.deltaPct,
          isSaved: true,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario-runs"] });
      toast.success("Scenario saved");
    },
    onError: (e: Error) => {
      if (e.message === "limit") {
        toast.error("You can save up to 5 scenarios. Delete one to save a new one.");
      } else {
        toast.error("Failed to save scenario.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/client/scenarios/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenario-runs"] });
      toast.success("Scenario deleted.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/client/scenarios/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenario-runs", "advisor"] }),
  });

  return {
    savedScenarios: savedQuery.data ?? [],
    advisorScenarios: advisorQuery.data ?? [],
    loading: savedQuery.isLoading,
    runScenario: (params: ScenarioParams): ScenarioResult => runScenario(params),
    saveScenario: (result: ScenarioResult, name: string) =>
      saveMutation.mutateAsync({ result, name }),
    deleteScenario: (id: string) => deleteMutation.mutateAsync(id),
    markAdvisorScenarioViewed: (id: string) =>
      statusMutation.mutateAsync({ id, status: "viewed" }),
    isSaving: saveMutation.isPending,
  };
}
