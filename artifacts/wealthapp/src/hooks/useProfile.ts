import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { identifyUser } from "@/lib/analytics";
import { getGetClientSetupChecklistQueryKey } from "@workspace/api-client-react";

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: "free_user" | "investment_client" | "advisor" | "super_admin";
  avatarUrl: string | null;
  preferredCurrency: string | null;
  countryCode: string | null;
  isExpat: boolean | null;
  /** Owned by client_profiles; returned on /profiles/me for convenience. */
  riskProfile: string | null;
  riskProfileSource?: "self" | "advisor" | null;
  /** First of the month, YYYY-MM-01 (month + year only). */
  dateOfBirth?: string | null;
  onboardingComplete: boolean | null;
  totalSavings: string | null;
  totalInvestments: string | null;
  savingsRatePercent: string | null;
  investmentRatePercent: string | null;
  createdAt: string;
}

export function useProfile() {
  const { user, isLoaded } = useUser();

  const query = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => apiFetch<Profile>("/profiles/me"),
    enabled: isLoaded && !!user,
  });

  useEffect(() => {
    if (query.data) {
      identifyUser(query.data.id, {
        role: query.data.role,
        isExpat: !!query.data.isExpat,
        countryCode: query.data.countryCode,
      });
    }
  }, [query.data]);

  const qc = useQueryClient();
  const upsert = useMutation({
    mutationFn: (data: { email: string; fullName?: string }) =>
      apiFetch<Profile>("/profiles/me/upsert", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });

  const update = useMutation({
    mutationFn: (data: Partial<Profile>) =>
      apiFetch<Profile>("/profiles/me", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
      qc.invalidateQueries({ queryKey: getGetClientSetupChecklistQueryKey() });
    },
  });

  return { profile: query.data, isLoading: query.isLoading, upsert, update };
}
