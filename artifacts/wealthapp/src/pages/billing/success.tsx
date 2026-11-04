import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Sol from "@/components/Sol";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";
import { ENTITLEMENTS_QUERY_KEY } from "@/hooks/useEntitlements";

interface SubscriptionStatus {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: string | null;
}

const PLAN_LABELS: Record<string, string> = { member_monthly: "Monthly", member_annual: "Annual" };

export default function BillingSuccess() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    // The webhook that activates the membership runs async, and only it decides the tier.
    // Invalidating here means the UI picks that up as soon as it lands.
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
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

  const planLabel = subscription?.plan ? PLAN_LABELS[subscription.plan] ?? null : null;
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
