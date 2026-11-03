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
    currency?: string;
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
        currency,
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
          <div className="bg-breeze rounded-[16px] p-4 text-[13px] text-forest leading-[1.45]">
            <span className="font-semibold">Auto-tracked:</span> progress updates from your linked investments.
          </div>
        ) : goal.targetAmountNum && goal.computedCurrentAmount > 0 ? (
          <div className="bg-surface rounded-[16px] p-4 text-[13px] text-forest tabular-nums">
            Current progress: ${Math.round(goal.computedCurrentAmount).toLocaleString()} / ${Math.round(goal.targetAmountNum).toLocaleString()} ({Math.round(goal.progressPct ?? 0)}%)
          </div>
        ) : null}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-forest">Goal name</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-40 focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
        </div>

        {/* Target amount */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-forest">Target amount <span className="text-ink-40 font-normal">(optional)</span></label>
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
        </div>

        {/* Manual current amount (only if no links) */}
        {!hasLinks && (
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-forest">
              Current amount saved <span className="text-ink-40 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              value={currentAmount}
              onChange={e => setCurrentAmount(e.target.value)}
              placeholder="0"
              min={0}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest tabular-nums placeholder:text-ink-40 focus:outline-none focus:ring-2 focus:ring-forest/30 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-[12px] text-ink-40">Link investments above to auto-track this.</p>
          </div>
        )}

        {/* Target date */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-forest">Target date <span className="text-ink-40 font-normal">(optional)</span></label>
          <input
            type="month"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full h-12 px-4 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-40 focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-forest">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button key={p.value} onClick={() => setPriority(p.value)}
                className={cn("flex-1 h-11 rounded-full text-[14px] font-semibold transition-colors",
                  priority === p.value ? "bg-forest text-paper" : "bg-surface text-forest hover:bg-breeze")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-forest">Notes <span className="text-ink-40 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-[14px] bg-surface border-0 text-[14px] text-forest placeholder:text-ink-40 resize-none focus:outline-none focus:ring-2 focus:ring-forest/30"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full h-12 px-5 rounded-full bg-forest text-paper font-semibold text-[15px] hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        <div className="border-t border-hairline pt-4">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-[13px] text-ink-40 text-center">Remove "{goal.title}"? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => { onDelete(goal.id); onClose(); }} className="flex-1 h-11 rounded-full bg-red-600 text-white text-[14px] font-semibold hover:bg-red-700 transition-colors">
                  Yes, remove
                </button>
                <button onClick={() => setConfirmDelete(false)} className="flex-1 h-11 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[14px] font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full h-11 rounded-full border-[1.5px] border-red-300 bg-transparent text-red-600 text-[14px] font-semibold hover:bg-red-50 transition-colors"
            >
              Delete goal
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
