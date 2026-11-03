import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { Home, Landmark, Shield, Briefcase, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ManualAsset } from "@/hooks/useNetWorthItems";

const ASSET_CATEGORIES = [
  { value: "property",   icon: Home, label: "Property",       placeholder: "e.g. Hanoi apartment" },
  { value: "cash",       icon: Landmark, label: "Cash & savings",  placeholder: "e.g. Techcombank savings" },
  { value: "pension",    icon: Shield, label: "Pension",          placeholder: "e.g. UK workplace pension" },
  { value: "business",  icon: Briefcase, label: "Business",         placeholder: "e.g. Stake in XYZ Ltd" },
  { value: "other_asset",icon: MoreHorizontal, label: "Other",           placeholder: "e.g. Art collection, Gold" },
];

const CURRENCIES = ["USD", "VND", "EUR"] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string; category: string; valueUsd: number; currencyOriginal: string;
  }) => Promise<void>;
}

export default function AddAssetSheet({ isOpen, onClose, onSave }: Props) {
  const [category, setCategory] = useState("property");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const catInfo = ASSET_CATEGORIES.find(c => c.value === category);
  const numVal = parseFloat(value) || 0;

  function reset() {
    setCategory("property");
    setName("");
    setValue("");
    setCurrency("USD");
    setError("");
  }

  async function handleSave() {
    if (!name.trim() || numVal <= 0) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), category, valueUsd: numVal, currencyOriginal: currency });
      reset();
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Add an asset">
      <div className="space-y-5 pb-4">
        {/* Category note for investment */}
        <div className="bg-breeze rounded-[24px] p-4 text-[13px] leading-relaxed text-forest">
          <span className="font-semibold text-forest">Investment assets</span> are synced automatically from your Portfolio page and shown separately.
        </div>

        {/* Category picker */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-forest">Category *</label>
          <div className="flex flex-wrap gap-2">
            {ASSET_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "h-10 px-3.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5",
                  category === cat.value
                    ? "bg-forest text-paper"
                    : "bg-surface text-forest hover:bg-breeze"
                )}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Label */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-forest">Label *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={catInfo?.placeholder ?? "Describe this asset"}
            className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
        </div>

        {/* Value */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-forest">Current value *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="0"
              min={0}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="flex-1 min-w-0 h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-forest/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="inline-flex items-center bg-surface rounded-full p-1 shrink-0">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "h-10 px-3 rounded-full text-[12px] font-semibold transition-all",
                    currency === c ? "bg-forest text-paper" : "text-ink-40 hover:text-forest"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-[13px] font-medium text-clay-ink">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!name.trim() || numVal <= 0 || saving}
          className="w-full h-12 px-5 rounded-full bg-forest text-paper font-semibold text-[14px] hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Add asset"}
        </button>
      </div>
    </BottomSheet>
  );
}
