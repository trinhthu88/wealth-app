import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";

const GOAL_TYPES = [
  { id: "retire",    emoji: "🌴", label: "Retire comfortably",      defaultTitle: "Comfortable retirement"    },
  { id: "property",  emoji: "🏠", label: "Buy property",            defaultTitle: "Buy my home"               },
  { id: "education", emoji: "📚", label: "Children's education",    defaultTitle: "Children's education fund" },
  { id: "fire",      emoji: "🚀", label: "Financial independence",  defaultTitle: "Financial independence"    },
  { id: "business",  emoji: "💼", label: "Build a business",        defaultTitle: "Build my business"         },
  { id: "emigrate",  emoji: "🌍", label: "Emigrate",               defaultTitle: "Move abroad"               },
  { id: "wealth",    emoji: "💰", label: "Wealth preservation",     defaultTitle: "Wealth preservation"       },
  { id: "emergency", emoji: "🛡️", label: "Emergency fund",          defaultTitle: "Emergency fund"            },
];

const CURRENCIES = ["USD", "VND", "EUR"] as const;
const PRIORITIES = [
  { label: "High",   value: "high"   },
  { label: "Medium", value: "medium" },
  { label: "Low",    value: "low"    },
];

// 3 months from today min
function minTargetDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 7);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string; goalType: string; targetAmount?: number | null;
    targetDate?: string | null; priority: string; notes?: string | null;
  }) => Promise<void>;
}

export default function AddGoalSheet({ isOpen, onClose, onSave }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function selectType(typeId: string) {
    const t = GOAL_TYPES.find(g => g.id === typeId);
    setSelectedType(typeId);
    if (!title && t) setTitle(t.defaultTitle);
  }

  function reset() {
    setSelectedType(null); setTitle(""); setTargetAmount(""); setCurrency("USD");
    setTargetDate(""); setPriority("medium"); setNotes(""); setError("");
  }

  async function handleSave() {
    if (!title.trim() || !selectedType) { setError("Goal name is required."); return; }
    setSaving(true); setError("");
    try {
      const numAmount = parseFloat(targetAmount) || 0;
      await onSave({
        title: title.trim(),
        goalType: selectedType,
        targetAmount: numAmount > 0 ? numAmount : null,
        targetDate: targetDate ? targetDate + "-01" : null,
        priority,
        notes: notes.trim() || null,
      });
      reset(); onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="Add a goal" height="full">
      <div className="space-y-6 pb-4">
        {/* Step 1: Goal type */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[#042C53]">What type of goal?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {GOAL_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => selectType(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                  selectedType === t.id
                    ? "border-[#1D9E75] bg-[#1D9E75]/5"
                    : "border-slate-200 hover:border-[#1D9E75]/30"
                )}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="text-xs font-medium text-[#042C53] leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Details (shown after type selected) */}
        {selectedType && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            {/* Goal name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#042C53]">Goal name *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Name your goal"
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
              />
            </div>

            {/* Target amount (optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#042C53]">
                Target amount <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={targetAmount}
                  onChange={e => setTargetAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  style={{ MozAppearance: "textfield" } as React.CSSProperties}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="inline-flex items-center bg-slate-100 rounded-xl p-0.5">
                  {CURRENCIES.map(c => (
                    <button key={c} onClick={() => setCurrency(c)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium", currency === c ? "bg-white text-[#042C53] shadow-sm" : "text-slate-500")}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400">Leave blank if you don't have a specific number yet. No progress bar will be shown.</p>
            </div>

            {/* Target date (optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#042C53]">
                Target date <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="month"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                min={minTargetDate()}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
              />
              <p className="text-xs text-slate-400">When do you want to reach this goal?</p>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#042C53]">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex-1 py-2 rounded-xl border text-sm font-medium transition-all",
                      priority === p.value
                        ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
                        : "border-slate-200 text-slate-500 hover:border-[#1D9E75]/30"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#042C53]">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional context about this goal..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save goal"}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
