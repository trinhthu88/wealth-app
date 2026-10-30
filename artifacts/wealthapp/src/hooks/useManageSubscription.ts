import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// Fires POST /billing/create-portal-session and redirects the already-subscribed
// user into Stripe's hosted billing portal.
export function useManageSubscription() {
  return useMutation({
    mutationFn: () => apiFetch<{ url: string }>("/billing/create-portal-session", { method: "POST" }),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: () => toast.error("Something went wrong. Please try again."),
  });
}
