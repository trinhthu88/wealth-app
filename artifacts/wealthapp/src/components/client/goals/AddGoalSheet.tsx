import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";
import { Palmtree, Home, GraduationCap, Rocket, Briefcase, Globe, Coins, Shield } from "lucide-react";

const GOAL_TYPES = [
  { id: "retire",    icon: Palmtree, label: "Retire comfortably",      defaultTitle: "Comfortable retirement"    },
  { id: "property",  icon: Home, label: "Buy property",            defaultTitle: "Buy my home"               },
  { id: "education", icon: GraduationCap, label: "Children's education",    defaultTitle: "Children's education fund" },
  { id: "fire",      icon: Rocket, label: "Financial independence",  defaultTitle: "Financial independence"    },
  { id: "business",  icon: Briefcase, label: "Build a business",        defaultTitle: "Build my business"         },
  { id: "emigrate",  icon: Globe, label: "Emigrate",               defaultTitle: "Move abroad"               },
  { id: "wealth",    icon: Coins, label: "Wealth preservation",     defaultTitle: "Wealth preservation"       },
  { id: "emergency", icon: Shield, label: "Emergency fund",          defaultTitle: "Emergency fund"            },
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
          <p className="text-[16px] font-semibold text-forest">What type of goal?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {GOAL_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => selectType(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 min-h-[88px] justify-center rounded-[14px] transition-colors text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40",
                  selectedType === t.id
                    ? "bg-field ring-2 ring-forest"
                    : "bg-surface hover:bg-breeze"
                )}
              >
                <t.icon className="w-6 h-6 mb-1 text-forest" />
                <span className="text-[12px] font-semibold text-forest leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Details (shown after type selected) */}
        {selectedType && (
          <div className="space-y-4 border-t border-hairline pt-5">
            {/* Goal name */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-forest">Goal name *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Name your goal"
                autoFocus
                className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-40 focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>

            {/* Target amount (optional) */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-forest">
                Target amount <span className="text-ink-40 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={targetAmount}
                  onChange={e => setTargetAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  style={{ MozAppearance: "textfield" } as React.CSSProperties}
                  className="flex-1 min-w-0 h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest tabular-nums placeholder:text-ink-40 focus:outline-none focus:ring-2 focus:ring-forest/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="inline-flex items-center bg-surface rounded-full p-1 shrink-0">
                  {CURRENCIES.map(c => (
                    <button key={c} onClick={() => setCurrency(c)} className={cn("h-10 px-3 rounded-full text-[12px] font-semibold transition-colors", currency === c ? "bg-forest text-paper" : "text-forest hover:bg-forest/10")}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[12px] text-ink-40">Leave blank if you don't have a specific number yet. No progress bar will be shown.</p>
            </div>

            {/* Target date (optional) */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-forest">
                Target date <span className="text-ink-40 font-normal">(optional)</span>
              </label>
              <input
                type="month"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                min={minTargetDate()}
                className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-40 focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
              <p className="text-[12px] text-ink-40">When do you want to reach this goal?</p>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-forest">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex-1 h-11 rounded-full text-[14px] font-semibold transition-colors",
                      priority === p.value
                        ? "bg-forest text-paper"
                        : "bg-surface text-forest hover:bg-breeze"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-forest">
                Notes <span className="text-ink-40 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional context about this goal..."
                rows={2}
                className="w-full px-4 py-3 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-40 resize-none focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
            </div>

            {error && <p className="text-[13px] text-red-600">{error}</p>}

            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="w-full h-12 px-5 rounded-full bg-forest text-paper font-semibold text-[15px] hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save goal"}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
