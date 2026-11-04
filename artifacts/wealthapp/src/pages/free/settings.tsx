// ANIMATION RULES FOR THIS PAGE:
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#F1F4FE, #F1F4FE, #8F98C8)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav / back button — the shell renders the menu bar and the "‹ Home" pill

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useClerk } from "@clerk/react";
import AppShell from "@/components/AppShell";
import { useProfile } from "@/hooks/useProfile";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-[14px] border-0 bg-paper px-[14px] text-[15px] text-forest outline-none placeholder:text-ink-30 focus-visible:ring-2 focus-visible:ring-forest/30";

const fieldClass = "flex flex-col gap-1.5 border-b border-hairline p-3 last:border-0";

const CURRENCIES = [
  { value: "USD", label: "USD $" },
  { value: "VND", label: "VND ₫" },
];

/** Two-option pill toggle on a paper track (Cobalt when active). */
function PillToggle<T>({ label, options, value, onChange }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1 rounded-full bg-paper p-1">
      {options.map(o => {
        const selected = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={selected}
            className={cn(
              "h-10 rounded-full text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30",
              selected ? "bg-forest text-paper" : "text-forest hover:bg-surface",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FreeSettingsPage() {
  const { profile, update } = useProfile();
  const { signOut } = useClerk();

  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [isExpat, setIsExpat] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setCountryCode(profile.countryCode ?? "");
    setPreferredCurrency(profile.preferredCurrency ?? "USD");
    setIsExpat(profile.isExpat ?? null);
  }, [profile?.id]);

  function save() {
    update.mutate(
      { fullName, countryCode, preferredCurrency, isExpat } as any,
      { onSuccess: () => toast.success("Settings saved"), onError: () => toast.error("Failed to save settings") },
    );
  }

  const initials = (fullName || profile?.fullName || "You").split(" ").filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="space-y-3.5 pb-8">
        <h1 className="sr-only">Settings</h1>

        {/* Cobalt profile hero */}
        <section aria-label="Profile" className="flex items-center gap-4 rounded-[28px] bg-forest p-5 text-paper">
          <span className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full bg-field font-display text-[32px] leading-none text-forest">
            {initials}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-display text-[30px] leading-none">{profile?.fullName || "Your profile"}</span>
            {profile?.email && <span className="truncate text-[14px] text-mint">{profile.email}</span>}
            <span className="self-start rounded-full bg-paper/15 px-2.5 py-1 text-[12px] font-semibold text-paper">Free plan</span>
          </div>
        </section>

        <h2 id="details-heading" className="px-1 pt-1 font-sans text-[16px] font-semibold text-forest">Your details</h2>
        <form
          aria-labelledby="details-heading"
          onSubmit={e => { e.preventDefault(); save(); }}
          className="flex flex-col rounded-[24px] bg-surface p-1"
        >
          <div className={fieldClass}>
            <label htmlFor="settings-name" className="tala-eyebrow text-ink-40">Full name</label>
            <input id="settings-name" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" className={inputClass} />
          </div>

          <div className={fieldClass}>
            <label htmlFor="settings-country" className="tala-eyebrow text-ink-40">Country</label>
            <input
              id="settings-country"
              value={countryCode} onChange={e => setCountryCode(e.target.value)}
              placeholder="e.g. VN, US, SG"
              className={inputClass}
            />
          </div>

          <div className={fieldClass}>
            <span className="tala-eyebrow text-ink-40">Currency</span>
            <PillToggle label="Preferred currency" options={CURRENCIES} value={preferredCurrency} onChange={setPreferredCurrency} />
          </div>

          <div className={fieldClass}>
            <span className="tala-eyebrow text-ink-40">Living outside your home country?</span>
            <PillToggle<boolean | null>
              label="Living outside your home country"
              options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]}
              value={isExpat}
              onChange={setIsExpat}
            />
          </div>
        </form>

        {/* Plan row → Advisor tab, where the plans live */}
        <Link
          href="/free/advisor"
          onClick={() => track("upgrade_cta_clicked", { location: "free_settings_plan_row", action: "open_advisor" })}
          className="flex items-center gap-3 rounded-[24px] bg-field p-4 text-forest"
        >
          <span className="flex-1 text-[14px] leading-[1.45]">
            <b className="font-semibold">Free plan</b> · See what working with an advisor adds
          </span>
          <span className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-forest px-3.5 text-[13px] font-semibold text-paper">
            Upgrade
          </span>
        </Link>

        <button
          type="button"
          onClick={save}
          disabled={update.isPending}
          className="h-[52px] w-full rounded-full bg-forest text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => { void signOut({ redirectUrl: "/" }); }}
          className="h-11 w-full rounded-full border-[1.5px] border-forest text-[14px] font-semibold text-forest transition-colors hover:bg-surface"
        >
          Sign out
        </button>
      </div>
    </AppShell>
  );
}
