import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Sol from "@/components/Sol";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";

interface SubscriptionStatus {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripePriceId: string | null;
}

interface PriceInfo {
  id: string;
  label: string;
  amount: number;
  interval: string;
}

interface PricesResponse {
  monthly: PriceInfo;
  yearly: PriceInfo;
}

export default function BillingSuccess() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    // The webhook that promotes the user's role runs async — invalidating
    // here means the UI picks up investment_client as soon as it lands,
    // rather than waiting for some other query to naturally refetch it.
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    track("subscription_activated", { source: "checkout" });
  }, [queryClient]);

  useEffect(() => {
    const timer = setTimeout(() => setLocation("/dashboard"), 2000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  const { data: subscription } = useQuery<SubscriptionStatus>({
    queryKey: ["billing-subscription"],
    queryFn: () => apiFetch<SubscriptionStatus>("/billing/subscription"),
  });
  const { data: prices } = useQuery<PricesResponse>({
    queryKey: ["billing-prices"],
    queryFn: () => apiFetch<PricesResponse>("/billing/prices"),
    staleTime: Infinity,
  });

  const planLabel = subscription?.stripePriceId && prices
    ? Object.values(prices).find(p => p.id === subscription.stripePriceId)?.label
    : null;
  const nextBillingDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <Sol size="lg" animate="breathe" showFace />
      <h1 className="font-display text-[24px] font-bold text-forest tracking-[-0.02em]">
        You're all set! Welcome to tala.
      </h1>
      {(planLabel || nextBillingDate) && (
        <p className="text-sm text-ink-40">
          {planLabel && <>{planLabel} plan</>}
          {planLabel && nextBillingDate && " · "}
          {nextBillingDate && <>renews {nextBillingDate}</>}
        </p>
      )}
      <p className="text-xs text-ink-40">Redirecting you to your dashboard…</p>
    </div>
  );
}
