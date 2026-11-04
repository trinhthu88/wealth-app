import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ANNUAL_MONTHS_FREE } from "@workspace/tier-policy";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatStripeAmount } from "@/lib/formatPrice";
import { queryClient } from "@/lib/queryClient";
import { toast } from "sonner";

interface StripePrice {
  id: string;
  nickname: string | null;
  productName: string | null;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
}

interface Settings {
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  source: "settings" | "env" | null;
  updatedAt: string | null;
}

interface BillingPrice {
  priceId: string;
  amount: number | null;
  currency: string;
  active: boolean;
}

interface BillingPrices {
  monthly: BillingPrice;
  annual: BillingPrice;
  source: "settings" | "env";
}

function priceLabel(price: StripePrice): string {
  const amount = price.unitAmount === null ? "No fixed amount" : formatStripeAmount(price.unitAmount, price.currency);
  return `${price.productName ?? "Unnamed product"}${price.nickname ? ` · ${price.nickname}` : ""} · ${amount} / ${price.interval}`;
}

function Current({ label, price, per }: { label: string; price?: BillingPrice; per: string }) {
  return (
    <div className="rounded-[20px] bg-surface p-5">
      <p className="text-[13px] font-medium text-ink-60">{label}</p>
      <p className="mt-1 font-display text-[24px] font-bold text-forest tabular-nums">
        {price?.amount != null ? formatStripeAmount(price.amount, price.currency) : "—"}
        <span className="text-[13px] font-medium text-ink-40"> / {per}</span>
      </p>
      {price && <p className="mt-1 break-all text-[12px] text-ink-40">{price.priceId}</p>}
      {price && !price.active && (
        <p className="mt-2 text-[13px] font-medium text-clay-ink">This price is no longer active in Stripe, so sign-up on this plan will fail. Choose another.</p>
      )}
    </div>
  );
}

function PriceSelect({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: StripePrice[]; onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-60">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-[12px] border border-hairline bg-paper px-4 text-[14px] text-forest"
      >
        <option value="">Choose a price</option>
        {options.map((price) => <option key={price.id} value={price.id}>{priceLabel(price)}</option>)}
      </select>
    </div>
  );
}

export default function AdminMembership() {
  const settings = useQuery<Settings>({
    queryKey: ["admin-membership-settings"],
    queryFn: () => apiFetch<Settings>("/admin/membership/settings"),
  });
  const prices = useQuery<StripePrice[]>({
    queryKey: ["admin-membership-prices"],
    queryFn: () => apiFetch<StripePrice[]>("/admin/membership/prices"),
    retry: false,
  });
  const current = useQuery<BillingPrices>({
    queryKey: ["billing-prices"],
    queryFn: () => apiFetch<BillingPrices>("/billing/prices"),
    retry: false,
  });

  const [monthlyPriceId, setMonthlyPriceId] = useState("");
  const [annualPriceId, setAnnualPriceId] = useState("");
  useEffect(() => {
    if (settings.data) {
      setMonthlyPriceId(settings.data.monthlyPriceId ?? "");
      setAnnualPriceId(settings.data.annualPriceId ?? "");
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => apiFetch("/admin/membership/settings", { method: "PUT", body: JSON.stringify({ monthlyPriceId, annualPriceId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-membership-settings"] });
      queryClient.invalidateQueries({ queryKey: ["billing-prices"] });
      toast.success("Membership prices saved");
    },
    onError: (e: Error) => toast.error(e.message || "We couldn't save those prices."),
  });

  const unchanged = monthlyPriceId === settings.data?.monthlyPriceId && annualPriceId === settings.data?.annualPriceId
    && settings.data?.source === "settings";

  return (
    <AppShell>
      <PageHeader title="Membership" subtitle="Choose which Stripe prices the app sells. Amounts are set in Stripe." />
      <div className="max-w-2xl space-y-6">
        {settings.data?.source === "env" && (
          <p role="status" className="rounded-[14px] bg-surface px-4 py-3 text-[14px] text-ink-60">
            No prices have been chosen here yet, so the app is selling the ones in the environment. Save to take over.
          </p>
        )}

        <section aria-label="Current prices" className="grid gap-4 sm:grid-cols-2">
          <Current label="Monthly" price={current.data?.monthly} per="month" />
          <Current label="Annual" price={current.data?.annual} per="year" />
        </section>
        {current.isError && <p className="text-[14px] text-clay-ink">We couldn't load the current prices from Stripe.</p>}

        <section aria-label="Choose prices" className="space-y-4 rounded-[20px] bg-surface p-5">
          {prices.isError ? (
            <p className="text-[14px] text-clay-ink">We couldn't reach Stripe to list your prices. Check the Stripe keys, then reload.</p>
          ) : (
            <>
              <PriceSelect
                id="monthly-price" label="Monthly price" value={monthlyPriceId} onChange={setMonthlyPriceId}
                options={(prices.data ?? []).filter((p) => p.interval === "month")}
              />
              <PriceSelect
                id="annual-price" label="Annual price" value={annualPriceId} onChange={setAnnualPriceId}
                options={(prices.data ?? []).filter((p) => p.interval === "year")}
              />
              <p className="text-[13px] text-ink-40">
                Hint: the annual price usually gives {ANNUAL_MONTHS_FREE} months free. Members on an existing subscription stay on their current price; a new selection applies to new sign-ups.
              </p>
              <Button
                className="h-11 rounded-full bg-green px-6 text-surface hover:bg-green-300"
                disabled={!monthlyPriceId || !annualPriceId || unchanged || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
