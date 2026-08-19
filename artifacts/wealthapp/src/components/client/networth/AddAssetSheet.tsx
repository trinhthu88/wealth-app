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
        <div className="bg-[#1D9E75]/5 border border-[#1D9E75]/20 rounded-xl p-3 text-xs text-slate-600">
          <span className="font-semibold text-[#1D9E75]">Investment assets</span> are synced automatically from your Portfolio page and shown separately.
        </div>

        {/* Category picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#042C53]">Category *</label>
          <div className="flex flex-wrap gap-2">
            {ASSET_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm border transition-all flex items-center gap-1.5",
                  category === cat.value
                    ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75] font-medium"
                    : "border-slate-200 text-slate-600 hover:border-[#1D9E75]/40"
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
          <label className="text-sm font-medium text-[#042C53]">Label *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={catInfo?.placeholder ?? "Describe this asset"}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
          />
        </div>

        {/* Value */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Current value *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="0"
              min={0}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="inline-flex items-center bg-slate-100 rounded-xl p-0.5">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                    currency === c ? "bg-white text-[#042C53] shadow-sm" : "text-slate-500"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!name.trim() || numVal <= 0 || saving}
          className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Add asset"}
        </button>
      </div>
    </BottomSheet>
  );
}
