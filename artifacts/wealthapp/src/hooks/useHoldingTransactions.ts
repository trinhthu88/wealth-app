import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export type HoldingTransactionType = "in" | "out" | "fee" | "value_update";

export interface HoldingTransaction {
  id: string;
  holdingId: string;
  userId: string;
  type: HoldingTransactionType;
  amount: string;
  source: "manual" | "budget_contribution" | "surplus_sweep";
  sourceMonth: string | null;
  description: string | null;
  transactionDate: string;
  units: string | null;
  balanceAfter: string | null;
  createdAt: string;
}

export interface AddHoldingTransactionInput {
  type: HoldingTransactionType;
  amount: number;
  description?: string;
  transactionDate?: string;
  units?: number;
}

export function useHoldingTransactions(holdingId: string | null) {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();

  const query = useQuery<HoldingTransaction[]>({
    queryKey: ["holding-transactions", holdingId],
    queryFn: () => apiFetch(`/client/holdings/${holdingId}/transactions`),
    enabled: isLoaded && !!user && !!holdingId,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["holding-transactions", holdingId] });
    qc.invalidateQueries({ queryKey: ["client-holdings-raw"] });
  }

  const addTransaction = useMutation({
    mutationFn: (data: AddHoldingTransactionInput) =>
      apiFetch(`/client/holdings/${holdingId}/transactions`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });

  const deleteTransaction = useMutation({
    mutationFn: (txId: string) =>
      apiFetch(`/client/holdings/${holdingId}/transactions/${txId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return {
    transactions: query.data ?? [],
    loading: query.isLoading,
    addTransaction: (data: AddHoldingTransactionInput) => addTransaction.mutateAsync(data),
    deleteTransaction: (txId: string) => deleteTransaction.mutateAsync(txId),
    adding: addTransaction.isPending,
  };
}
