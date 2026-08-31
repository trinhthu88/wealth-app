// ANIMATION RULES FOR THIS PAGE:
// ✗ BANNED:  Page-load stagger on sections
// ✗ BANNED:  JetBrains Mono font
// ✗ BANNED:  Cream/warm palette (#FAF8F5, #F2EFE9, #A8A095)
// ✗ BANNED:  Inline style={{ color: '#hexcode' }} — use Tailwind tokens only
// ✗ BANNED:  Double bottom nav — AppShell is the ONLY nav

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

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

  return (
    <AppShell>
      <div className="pb-24 md:pb-0 space-y-4">
        <div>
          <h1 className="text-forest text-[22px] font-bold tracking-[-0.02em]">Settings</h1>
          <p className="text-[12px] text-ink-40 mt-0.5">Update the details we use to personalise your plan.</p>
        </div>

        <div className="bg-surface rounded-[20px] p-5 shadow-[0_4px_14px_rgba(20,52,42,.06)] space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Full name</label>
            <input
              value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Country</label>
            <input
              value={countryCode} onChange={e => setCountryCode(e.target.value)}
              placeholder="e.g. VN, US, SG"
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Preferred currency</label>
            <div className="relative">
              <select
                value={preferredCurrency} onChange={e => setPreferredCurrency(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:ring-2 focus:ring-primary appearance-none pr-10"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c === "VND" ? "VND (₫)" : "USD ($)"}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Living outside your home country?</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "Yes", val: true }, { label: "No", val: false }].map(o => (
                <button
                  key={String(o.val)}
                  onClick={() => setIsExpat(o.val)}
                  className={`rounded-xl border-2 p-3 text-sm font-medium transition-colors ${isExpat === o.val ? "border-green bg-green-tint text-green" : "border-hairline text-ink-40 hover:border-green/50"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
      <BottomNav />
    </AppShell>
  );
}
