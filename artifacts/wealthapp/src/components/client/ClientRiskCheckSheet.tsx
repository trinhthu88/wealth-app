import { useState } from "react";
import { Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useProfile } from "@/hooks/useProfile";

const QUESTIONS = [
  {
    prompt: "When your investments fall in value, what would you most likely do?",
    choices: ["Move to safer options", "Wait and review", "Stay invested or add over time"],
  },
  {
    prompt: "When might you need to use most of this money?",
    choices: ["Within 3 years", "In 3–7 years", "More than 7 years away"],
  },
  {
    prompt: "How familiar are you with investment ups and downs?",
    choices: ["I prefer steady and familiar", "I can accept some movement", "I understand values can move a lot"],
  },
  {
    prompt: "How would a temporary drop in your investment value feel?",
    choices: ["Very uncomfortable", "Uncomfortable, but manageable", "Expected as part of investing"],
  },
  {
    prompt: "Which feels closest to your priority?",
    choices: ["Protecting what I have", "A balance of stability and growth", "Growing value over the long term"],
  },
];

type Props = { isOpen: boolean; onClose: () => void };

export default function ClientRiskCheckSheet({ isOpen, onClose }: Props) {
  const { update } = useProfile();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(-1));
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function submit() {
    if (answers.some(answer => answer < 0)) return;
    const score = answers.reduce((total, answer) => total + answer, 0);
    const value = score <= 4 ? "conservative" : score <= 9 ? "balanced" : "growth";
    setSaving(true);
    try {
      await update.mutateAsync({ riskProfile: value });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
      ]);
      setAnswers(Array(QUESTIONS.length).fill(-1));
      onClose();
      toast.success("Your preferences have been saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't save your answers. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-forest/45 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="risk-check-title" className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-paper p-5 shadow-xl sm:rounded-[28px] sm:p-7" data-testid="sheet-risk-check">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-green">A short self-check</p>
            <h2 id="risk-check-title" className="mt-1 font-display text-2xl font-semibold text-forest">How do you feel about uncertainty?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-60">There are no right answers. This records your own comfort level for your advisor to discuss with you.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close risk check" data-testid="button-close-risk-check" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-40 hover:bg-forest/5 hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 space-y-5">
          {QUESTIONS.map((question, questionIndex) => (
            <fieldset key={question.prompt}>
              <legend className="mb-2 text-sm font-semibold leading-snug text-forest">{questionIndex + 1}. {question.prompt}</legend>
              <div className="space-y-2">
                {question.choices.map((choice, choiceIndex) => (
                  <label key={choice} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-snug ${answers[questionIndex] === choiceIndex ? "border-green bg-green/5" : "border-hairline bg-surface"}`}>
                    <input type="radio" name={`risk-question-${questionIndex}`} value={choiceIndex} checked={answers[questionIndex] === choiceIndex} onChange={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? choiceIndex : answer))} data-testid={`input-risk-answer-${questionIndex}-${choiceIndex}`} className="mt-0.5 h-4 w-4 accent-[var(--green)]" />
                    <span className="text-ink-60">{choice}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-40">Your answers are a starting point for a conversation, not a recommendation.</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} data-testid="button-cancel-risk-check" className="min-h-12 flex-1 rounded-xl border border-hairline bg-surface text-sm font-semibold text-forest">Not now</button>
          <button type="button" onClick={submit} disabled={answers.some(answer => answer < 0) || saving} data-testid="button-save-risk-check" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-green text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving…" : <><Check className="h-4 w-4" /> Save my answers</>}
          </button>
        </div>
      </section>
    </div>
  );
}
