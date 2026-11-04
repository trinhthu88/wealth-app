// ANIMATION RULES FOR THIS PAGE:
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav — the shell's menu bar is the ONLY nav
//
// The free plan's "Advisor" place. Investment clients see their advisor here;
// free users don't have one yet, so this is where they meet one: what an
// advisor adds, the advised plan's price, and a free call.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, Infinity as InfinityIcon, LineChart, MessageCircle, History } from "lucide-react";
import AppShell from "@/components/AppShell";
import Sol from "@/components/Sol";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { useManageSubscription } from "@/hooks/useManageSubscription";

type PlanKey = "monthly" | "yearly";
interface PriceInfo { label: string; amount: number; interval: string }
interface PricesResponse { monthly: PriceInfo; yearly: PriceInfo }

const PERKS = [
  { icon: MessageCircle, tint: "bg-field", name: "A named advisor", meta: "Messages and quarterly reviews" },
  { icon: LineChart, tint: "bg-breeze", name: "Managed portfolio", meta: "Synced into your net worth, with live prices" },
  { icon: InfinityIcon, tint: "bg-field", name: "Unlimited goals", meta: "Plus what-if on every goal" },
  { icon: History, tint: "bg-breeze", name: "Full history", meta: "12 months of budget and net worth" },
];

export default function FreeAdvisorPage() {
  const { profile } = useProfile();
  const isSubscribed = profile?.role === "investment_client";
  const manageSubscription = useManageSubscription();
  const [plan, setPlan] = useState<PlanKey>("yearly");
  const [loading, setLoading] = useState(false);

  const { data: prices } = useQuery<PricesResponse>({
    queryKey: ["billing-prices"],
    queryFn: () => apiFetch<PricesResponse>("/billing/prices"),
    staleTime: Infinity,
  });

  const price = prices?.[plan];
  const yearly = prices?.yearly;
  const monthly = prices?.monthly;
  const yearlyMonthly = yearly ? yearly.amount / 100 / 12 : null;
  const savePct = yearly && monthly ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : null;

  function pick(next: PlanKey) {
    setPlan(next);
    const p = prices?.[next];
    if (p) track("plan_selected", { plan: next, price: p.amount / 100 });
  }

  async function start() {
    track("upgrade_cta_clicked", { location: "free_advisor_tab", action: isSubscribed ? "manage_subscription" : "checkout" });
    if (isSubscribed) { manageSubscription.mutate(); return; }
    if (price) track("checkout_started", { plan, price: price.amount / 100 });
    setLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-3.5 pb-8">
        <div className="tala-eyebrow text-ink-40 px-1 pt-1">Your advisor</div>

        <section aria-label="Get an advisor" className="rounded-[28px] bg-forest p-5 text-paper space-y-4">
          <div className="flex">
            {[["MT", "bg-field"], ["LP", "bg-breeze"], ["AK", "bg-sun"]].map(([initials, tint], i) => (
              <span
                key={initials}
                aria-hidden="true"
                className={cn("flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-forest font-display text-[22px] text-forest", tint, i > 0 && "-ml-3.5")}
              >
                {initials}
              </span>
            ))}
          </div>
          <div>
            <h1 className="font-display text-[34px] leading-[1.05] text-paper">Get your own advisor</h1>
            <p className="mt-1.5 text-[14px] leading-[1.45] text-mint text-pretty">
              A tala advisor builds your plan, manages your portfolio and checks in with you every quarter.
            </p>
          </div>
          {!isSubscribed && (
            <>
              <div role="radiogroup" aria-label="Billing" className="grid grid-cols-2 gap-1 rounded-full bg-paper/15 p-1">
                {(["yearly", "monthly"] as const).map(k => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={plan === k}
                    onClick={() => pick(k)}
                    className={cn("h-10 rounded-full text-[14px] font-semibold transition-colors", plan === k ? "bg-field text-forest" : "text-paper")}
                  >
                    {k === "yearly" ? "Yearly" : "Monthly"}
                  </button>
                ))}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display tabular-nums text-[48px] leading-[0.9] tracking-[-0.045em]">
                  {price ? `$${(price.amount / 100).toFixed(2)}` : "—"}
                </span>
                <span className="text-[14px] text-mint">
                  {plan === "yearly"
                    ? `a year${yearlyMonthly ? ` · about $${yearlyMonthly.toFixed(2)} a month` : ""}${savePct ? ` · save ${savePct}%` : ""}`
                    : "a month · cancel any time"}
                </span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={start}
            disabled={loading || manageSubscription.isPending || (!isSubscribed && !prices)}
            className="flex h-12 w-full items-center justify-center rounded-full bg-field text-[15px] font-semibold text-forest transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubscribed ? "Manage subscription" : loading ? "Opening checkout…" : "Start advised plan"}
          </button>
        </section>

        <a
          href="mailto:hello@tala.app?subject=Free%20discovery%20call"
          onClick={() => track("upgrade_cta_clicked", { location: "free_advisor_tab_call" })}
          className="flex items-center gap-4 rounded-[28px] bg-sun p-5 text-forest"
        >
          <span className="flex flex-col items-center">
            <span className="font-display tabular-nums text-[52px] leading-[0.85]">20</span>
            <span className="text-[12px] font-semibold tracking-[0.1em]">MIN</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="tala-eyebrow block">Not sure yet?</span>
            <span className="mt-1 block text-[17px] font-semibold">Book a free call</span>
            <span className="block text-[14px]">Video · no commitment</span>
          </span>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-forest text-paper">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </a>

        <section aria-labelledby="advisor-perks" className="space-y-3 pt-1.5">
          <h2 id="advisor-perks" className="font-sans text-[16px] font-semibold text-forest px-1">What you add</h2>
          <div className="rounded-[28px] bg-surface p-1">
            {PERKS.map(({ icon: Icon, tint, name, meta }) => (
              <div key={name} className="flex items-center gap-3 border-b border-hairline p-3 last:border-0">
                <span className={cn("flex h-11 w-11 flex-none items-center justify-center rounded-[14px] text-forest", tint)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-forest">{name}</span>
                  <span className="block text-[13px] text-ink-40">{meta}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Sol" className="flex items-start gap-3 rounded-[24px] bg-breeze p-4">
          <Sol size="sm" animate="none" />
          <p className="text-[14px] leading-[1.5] text-forest text-pretty">
            Everything you've set up here — budget, goal, net worth — moves across. Nothing to re-enter.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
