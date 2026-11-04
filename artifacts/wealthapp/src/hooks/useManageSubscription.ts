import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// Fires POST /membership/portal and redirects the member into Stripe's hosted billing portal.
export function useManageSubscription() {
  return useMutation({
    mutationFn: () => apiFetch<{ url: string }>("/membership/portal", { method: "POST" }),
    onSuccess: (data) => { window.location.href = data.url; },
    onError: () => toast.error("Something went wrong. Please try again."),
  });
}
