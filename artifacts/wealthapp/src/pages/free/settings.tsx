// ANIMATION RULES FOR THIS PAGE:
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#F1F4FE, #F1F4FE, #8F98C8)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Page-level nav — the shell's menu bar is the ONLY nav

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const inputClass = "h-12 w-full rounded-[16px] border border-hairline-2 bg-paper px-4 text-[15px] text-forest outline-none transition-colors placeholder:text-ink-30 focus:border-green";

const CURRENCIES = ["USD", "VND"];

export default function FreeSettingsPage() {
  const { profile, update } = useProfile();

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

  const initials = (fullName || profile?.fullName || "You").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="space-y-5 pb-8">
        <div>
          <h1 className="font-display text-[30px] leading-[1.1] text-forest">Settings</h1>
          <p className="text-[14px] text-ink-40 mt-1.5">The details tala uses to personalise your plan.</p>
        </div>

        <div className="flex items-center gap-3.5 rounded-[28px] bg-forest p-5">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[18px] bg-field font-display text-[22px] text-forest">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold text-paper">{profile?.fullName || "Your profile"}</div>
            <div className="truncate text-[13px] text-mint">{profile?.email ?? ""}</div>
            <span className="mt-2 inline-block rounded-full bg-forest-700 px-2.5 py-0.5 text-[11px] font-semibold text-mint">Free plan</span>
          </div>
        </div>

        <section aria-labelledby="profile-heading" className="space-y-4 rounded-[24px] bg-surface p-5">
          <h2 id="profile-heading" className="font-sans text-[16px] font-semibold text-forest">Profile</h2>

          <div>
            <label htmlFor="settings-name" className="tala-eyebrow mb-2 block text-ink-40">Full name</label>
            <input id="settings-name" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label htmlFor="settings-country" className="tala-eyebrow mb-2 block text-ink-40">Country</label>
            <input
              id="settings-country"
              value={countryCode} onChange={e => setCountryCode(e.target.value)}
              placeholder="e.g. VN, US, SG"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="settings-currency" className="tala-eyebrow mb-2 block text-ink-40">Preferred currency</label>
            <div className="relative">
              <select
                id="settings-currency"
                value={preferredCurrency} onChange={e => setPreferredCurrency(e.target.value)}
                className={cn(inputClass, "appearance-none pr-10")}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c === "VND" ? "VND (₫)" : "USD ($)"}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" aria-hidden="true" />
            </div>
          </div>

          <fieldset>
            <legend className="tala-eyebrow mb-2 block text-ink-40">Living outside your home country?</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {[{ label: "Yes", val: true }, { label: "No", val: false }].map(o => {
                const selected = isExpat === o.val;
                return (
                  <button
                    key={String(o.val)}
                    type="button"
                    onClick={() => setIsExpat(o.val)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-12 items-center justify-center gap-1.5 rounded-[16px] text-[14px] font-semibold transition-colors",
                      selected ? "bg-forest text-paper" : "bg-paper text-forest hover:bg-green-tint",
                    )}
                  >
                    {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        <button
          type="button"
          onClick={save}
          disabled={update.isPending}
          className="h-12 w-full rounded-full bg-forest text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </AppShell>
  );
}
