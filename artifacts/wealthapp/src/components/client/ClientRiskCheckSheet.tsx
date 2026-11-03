import { useState } from "react";
import { Check, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getGetClientSetupChecklistQueryKey, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useProfile } from "@/hooks/useProfile";
import { riskProfileFromScore } from "@/lib/riskScore";

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
    const value = riskProfileFromScore(score);
    setSaving(true);
    try {
      await update.mutateAsync({ riskProfile: value });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetClientSetupChecklistQueryKey() }),
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
      <section role="dialog" aria-modal="true" aria-labelledby="risk-check-title" className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-paper p-5 sm:rounded-[28px] sm:p-7" data-testid="sheet-risk-check">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tala-eyebrow text-ink-40">A short self-check</p>
            <h2 id="risk-check-title" className="mt-2 font-display text-[28px] leading-[1.1] text-forest">How do you feel about uncertainty?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-40">There are no right answers. This records your own comfort level for your advisor to discuss with you.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close risk check" data-testid="button-close-risk-check" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-40 hover:bg-surface hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 space-y-5">
          {QUESTIONS.map((question, questionIndex) => (
            <fieldset key={question.prompt}>
              <legend className="mb-2 text-[14px] font-semibold leading-snug text-forest">{questionIndex + 1}. {question.prompt}</legend>
              <div className="space-y-2">
                {question.choices.map((choice, choiceIndex) => (
                  <label key={choice} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] p-3 text-[14px] leading-snug ${answers[questionIndex] === choiceIndex ? "border-forest bg-breeze" : "border-transparent bg-surface"}`}>
                    <input type="radio" name={`risk-question-${questionIndex}`} value={choiceIndex} checked={answers[questionIndex] === choiceIndex} onChange={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? choiceIndex : answer))} data-testid={`input-risk-answer-${questionIndex}-${choiceIndex}`} className="mt-0.5 h-4 w-4 accent-[var(--forest)]" />
                    <span className="text-forest">{choice}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-40">Your answers are a starting point for a conversation, not a recommendation.</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} data-testid="button-cancel-risk-check" className="min-h-12 flex-1 rounded-full border-[1.5px] border-forest bg-transparent px-5 text-[14px] font-semibold text-forest">Not now</button>
          <button type="button" onClick={submit} disabled={answers.some(answer => answer < 0) || saving} data-testid="button-save-risk-check" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-forest px-5 text-[14px] font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving…" : <><Check className="h-4 w-4" /> Save my answers</>}
          </button>
        </div>
      </section>
    </div>
  );
}
