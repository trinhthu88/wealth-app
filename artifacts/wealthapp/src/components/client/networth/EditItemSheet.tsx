import { useState, useEffect } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";
import type { ManualAsset, ManualLiability } from "@/hooks/useNetWorthItems";

const CURRENCIES = ["USD", "VND", "EUR"] as const;

interface EditAssetProps {
  item: ManualAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: { name: string; category: string; valueUsd: number; currencyOriginal: string }) => Promise<void>;
  onDelete: (id: string) => void;
}

interface EditLiabilityProps {
  item: ManualLiability | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: { name: string; category: string; balanceUsd: number; currencyOriginal: string; interestRatePercent?: number | null; monthlyPaymentUsd?: number | null }) => Promise<void>;
  onDelete: (id: string) => void;
}

export function EditAssetSheet({ item, isOpen, onClose, onSave, onDelete }: EditAssetProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setValue(String(item.valueUsd));
      setCurrency((item.currencyOriginal as typeof CURRENCIES[number]) ?? "USD");
      setConfirmDelete(false);
    }
  }, [item?.id]);

  if (!item) return null;
  const numVal = parseFloat(value) || 0;

  async function handleSave() {
    if (!item || !name.trim() || numVal <= 0) return;
    setSaving(true);
    try {
      await onSave(item.id, { name: name.trim(), category: item.category, valueUsd: numVal, currencyOriginal: currency });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Edit: ${item.name}`}>
      <div className="space-y-5 pb-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-forest">Label</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-hairline text-sm text-forest focus:outline-none focus:ring-2 focus:ring-green/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-forest">Current value</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={value}
              onChange={e => setValue(e.target.value)}
              min={0}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="flex-1 px-4 py-2.5 rounded-xl border border-hairline text-sm text-forest focus:outline-none focus:ring-2 focus:ring-green/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="inline-flex items-center bg-paper rounded-xl p-0.5">
              {CURRENCIES.map(c => (
                <button key={c} onClick={() => setCurrency(c)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium", currency === c ? "bg-surface text-forest shadow-sm" : "text-ink-40")}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || numVal <= 0 || saving}
          className="w-full py-3 rounded-xl bg-green text-white font-semibold text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        <div className="border-t border-hairline pt-4">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(item.id); onClose(); }}
                className="flex-1 py-2.5 rounded-xl bg-clay text-white text-sm font-medium"
              >
                Yes, remove
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-hairline text-ink-60 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2.5 rounded-xl border border-clay/30 text-clay text-sm font-medium hover:bg-clay-tint transition-colors"
            >
              Remove this asset
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

export function EditLiabilitySheet({ item, isOpen, onClose, onSave, onDelete }: EditLiabilityProps) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setBalance(String(item.balanceUsd));
      setCurrency((item.currencyOriginal as typeof CURRENCIES[number]) ?? "USD");
      setMonthlyPayment(item.monthlyPaymentUsd != null ? String(item.monthlyPaymentUsd) : "");
      setInterestRate(item.interestRatePercent != null ? String(item.interestRatePercent) : "");
      setConfirmDelete(false);
    }
  }, [item?.id]);

  if (!item) return null;
  const numBalance = parseFloat(balance) || 0;

  async function handleSave() {
    if (!item || !name.trim() || numBalance <= 0) return;
    setSaving(true);
    try {
      await onSave(item.id, {
        name: name.trim(),
        category: item.category,
        balanceUsd: numBalance,
        currencyOriginal: currency,
        interestRatePercent: parseFloat(interestRate) || null,
        monthlyPaymentUsd: parseFloat(monthlyPayment) || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Edit: ${item.name}`}>
      <div className="space-y-5 pb-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-forest">Label</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-hairline text-sm text-forest focus:outline-none focus:ring-2 focus:ring-clay/30" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-forest">Outstanding balance</label>
          <div className="flex gap-2">
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)} min={0} style={{ MozAppearance: "textfield" } as React.CSSProperties} className="flex-1 px-4 py-2.5 rounded-xl border border-hairline text-sm text-forest focus:outline-none focus:ring-2 focus:ring-clay/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <div className="inline-flex items-center bg-paper rounded-xl p-0.5">
              {CURRENCIES.map(c => (
                <button key={c} onClick={() => setCurrency(c)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium", currency === c ? "bg-surface text-forest shadow-sm" : "text-ink-40")}>{c}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-forest">Monthly payment <span className="text-ink-30 font-normal">(optional)</span></label>
          <input type="number" value={monthlyPayment} onChange={e => setMonthlyPayment(e.target.value)} placeholder="0" min={0} style={{ MozAppearance: "textfield" } as React.CSSProperties} className="w-full px-4 py-2.5 rounded-xl border border-hairline text-sm text-forest focus:outline-none focus:ring-2 focus:ring-clay/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-forest">Interest rate % <span className="text-ink-30 font-normal">(optional)</span></label>
          <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="e.g. 5.5" min={0} max={50} step={0.1} style={{ MozAppearance: "textfield" } as React.CSSProperties} className="w-full px-4 py-2.5 rounded-xl border border-hairline text-sm text-forest focus:outline-none focus:ring-2 focus:ring-clay/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>

        <button onClick={handleSave} disabled={!name.trim() || numBalance <= 0 || saving} className="w-full py-3 rounded-xl bg-clay text-white font-semibold text-sm disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : "Save changes"}
        </button>

        <div className="border-t border-hairline pt-4">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={() => { onDelete(item.id); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-clay text-white text-sm font-medium">Yes, remove</button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl border border-hairline text-ink-60 text-sm">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full py-2.5 rounded-xl border border-clay/30 text-clay text-sm font-medium hover:bg-clay-tint transition-colors">
              Remove this liability
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
