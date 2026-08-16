import { useState, useEffect } from "react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";
import type { EnrichedGoal } from "@/hooks/useGoals";

const CURRENCIES = ["USD", "VND", "EUR"] as const;
const PRIORITIES = [
  { label: "High",   value: "high"   },
  { label: "Medium", value: "medium" },
  { label: "Low",    value: "low"    },
];

interface Props {
  goal: EnrichedGoal | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: {
    title: string; goalType: string; targetAmount?: number | null;
    targetDate?: string | null; priority: string; notes?: string | null;
    currentAmount?: number | null;
  }) => Promise<void>;
  onDelete: (id: string) => void;
}

export default function EditGoalSheet({ goal, isOpen, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setTargetAmount(goal.targetAmount ?? "");
      setCurrency((goal.currency as typeof CURRENCIES[number]) ?? "USD");
      setTargetDate(goal.targetDate?.slice(0, 7) ?? "");
      setPriority(goal.priority ?? "medium");
      setNotes(goal.notes ?? "");
      setCurrentAmount(goal.links.length === 0 ? String(goal.computedCurrentAmount) : "");
      setConfirmDelete(false);
    }
  }, [goal?.id]);

  if (!goal) return null;

  const numAmount = parseFloat(targetAmount) || 0;
  const numCurrent = parseFloat(currentAmount) || 0;
  const hasLinks = goal.links.length > 0;

  async function handleSave() {
    if (!goal || !title.trim()) return;
    setSaving(true);
    try {
      await onSave(goal.id, {
        title: title.trim(),
        goalType: goal.goalType,
        targetAmount: numAmount > 0 ? numAmount : null,
        targetDate: targetDate ? targetDate + "-01" : null,
        priority,
        notes: notes.trim() || null,
        currentAmount: !hasLinks && numCurrent > 0 ? numCurrent : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Edit goal">
      <div className="space-y-4 pb-4">
        {/* Current progress (read-only) */}
        {hasLinks ? (
          <div className="bg-[#1D9E75]/5 border border-[#1D9E75]/20 rounded-xl p-3 text-xs text-slate-600">
            <span className="font-semibold text-[#1D9E75]">Auto-tracked:</span> progress updates from your linked investments.
          </div>
        ) : goal.targetAmountNum && goal.computedCurrentAmount > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
            Current progress: ${Math.round(goal.computedCurrentAmount).toLocaleString()} / ${Math.round(goal.targetAmountNum).toLocaleString()} ({Math.round(goal.progressPct ?? 0)}%)
          </div>
        ) : null}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Goal name</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
          />
        </div>

        {/* Target amount */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Target amount <span className="text-slate-400 font-normal">(optional)</span></label>
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
        </div>

        {/* Manual current amount (only if no links) */}
        {!hasLinks && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#042C53]">
              Current amount saved <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              value={currentAmount}
              onChange={e => setCurrentAmount(e.target.value)}
              placeholder="0"
              min={0}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-xs text-slate-400">Link investments above to auto-track this.</p>
          </div>
        )}

        {/* Target date */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Target date <span className="text-slate-400 font-normal">(optional)</span></label>
          <input
            type="month"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
          />
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button key={p.value} onClick={() => setPriority(p.value)}
                className={cn("flex-1 py-2 rounded-xl border text-sm font-medium transition-all",
                  priority === p.value ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]" : "border-slate-200 text-slate-500")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#042C53]">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] resize-none focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        <div className="border-t border-slate-100 pt-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">Remove "{goal.title}"? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => { onDelete(goal.id); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium">
                  Yes, remove
                </button>
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete goal
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
