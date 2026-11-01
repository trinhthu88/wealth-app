import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { toast } from "sonner";
import {
  getGetClientSetupChecklistQueryKey,
  getGetMyProfileQueryKey,
  useCompleteClientOnboarding,
  useGetClientSetupChecklist,
  useSaveClientProfileBasics,
} from "@workspace/api-client-react";
import { useProfile } from "@/hooks/useProfile";
import OnboardingShell from "@/components/client/onboarding/OnboardingShell";
import OnboardingNav from "@/components/client/onboarding/OnboardingNav";

type Focus = "know_my_money" | "start_investing" | "save_for_big" | "organise_existing" | "plan_retirement";
type BasicsDraft = {
  fullName: string;
  birthMonth: string;
  birthYear: string;
  countryCode: string;
  isExpat: boolean;
  preferredCurrency: string;
};

const DRAFT_KEY = "tala_client_basics_draft";
const MONTHS = [
  ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"],
  ["05", "May"], ["06", "June"], ["07", "July"], ["08", "August"],
  ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
];
const COUNTRIES = [
  ["SG", "Singapore"], ["MY", "Malaysia"], ["ID", "Indonesia"], ["TH", "Thailand"],
  ["VN", "Vietnam"], ["PH", "Philippines"], ["BN", "Brunei"], ["KH", "Cambodia"],
  ["LA", "Laos"], ["MM", "Myanmar"], ["US", "United States"], ["GB", "United Kingdom"],
  ["AU", "Australia"], ["IN", "India"], ["JP", "Japan"], ["Other", "Other"],
];
const CURRENCIES = ["USD", "SGD", "MYR", "IDR", "THB", "VND", "PHP", "EUR", "GBP", "AUD"];
const FOCI: { value: Focus; title: string; description: string }[] = [
  { value: "know_my_money", title: "Know where my money goes", description: "Get a clearer picture of what I have and where it goes." },
  { value: "start_investing", title: "Start investing", description: "Understand my starting point and next steps." },
  { value: "save_for_big", title: "Save for something big", description: "Make room for a goal that matters to me." },
  { value: "organise_existing", title: "Organise what I already have", description: "Bring my existing accounts and plans into one view." },
  { value: "plan_retirement", title: "Plan for retirement", description: "Start mapping out the future I want." },
];

function initialDraft(profile?: ReturnType<typeof useProfile>["profile"], clerkName?: string | null): BasicsDraft {
  const dob = profile?.dateOfBirth?.slice(0, 7).split("-") ?? [];
  return {
    fullName: profile?.fullName ?? clerkName ?? "",
    birthMonth: dob[1] ?? "",
    birthYear: dob[0] ?? "",
    countryCode: profile?.countryCode ?? "",
    isExpat: profile?.isExpat ?? false,
    preferredCurrency: profile?.preferredCurrency ?? "USD",
  };
}

function draftStorageKey(id?: string) {
  return `${DRAFT_KEY}:${id ?? "guest"}`;
}

export default function ClientOnboarding() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const checklist = useGetClientSetupChecklist();
  const saveBasics = useSaveClientProfileBasics();
  const complete = useCompleteClientOnboarding();
  const [screen, setScreen] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<BasicsDraft>(() => initialDraft());
  const [focus, setFocus] = useState<Focus | "">("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const key = draftStorageKey(user?.id);
    let saved: Partial<BasicsDraft> | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) saved = JSON.parse(raw);
    } catch {
      localStorage.removeItem(key);
    }
    setDraft({ ...initialDraft(profile, user?.fullName), ...(saved ?? {}) });
    setHydrated(true);
  }, [user?.id, user?.fullName, profile?.id, profile?.fullName]);

  useEffect(() => {
    if (!hydrated || screen !== 2) return;
    localStorage.setItem(draftStorageKey(user?.id), JSON.stringify(draft));
  }, [draft, hydrated, screen, user?.id]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => String(current - i));
  }, []);
  const latestBirthMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const availableBirthMonths = draft.birthYear === String(new Date().getFullYear())
    ? MONTHS.filter(([month]) => month <= latestBirthMonth)
    : MONTHS;
  const loading = saveBasics.isPending || complete.isPending;
  const basicsValid = draft.fullName.trim().length >= 2 && !!draft.birthMonth && !!draft.birthYear && !!draft.countryCode;

  async function continueStep() {
    try {
      if (screen === 1) {
        setDraft(current => ({ ...current, ...(!current.fullName ? { fullName: profile?.fullName ?? "" } : {}) }));
        setScreen(2);
        return;
      }
      if (screen === 2) {
        await saveBasics.mutateAsync({
          data: {
            fullName: draft.fullName.trim(),
            dateOfBirth: `${draft.birthYear}-${draft.birthMonth}`,
            countryCode: draft.countryCode,
            isExpat: draft.isExpat,
            preferredCurrency: draft.preferredCurrency,
          },
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetClientSetupChecklistQueryKey() }),
        ]);
        localStorage.removeItem(draftStorageKey(user?.id));
        setScreen(3);
        return;
      }
      if (!focus) return;
      await complete.mutateAsync({ data: { firstFocus: focus } });
      localStorage.removeItem(draftStorageKey(user?.id));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetClientSetupChecklistQueryKey() }),
      ]);
      navigate("/client/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't save that just yet. Please try again.");
    }
  }

  const canContinue = screen === 1 ? true : screen === 2 ? basicsValid : !!focus;
  const advisor = checklist.data?.advisorName;
  const clientName = checklist.data?.clientName ?? profile?.fullName ?? user?.fullName;

  return (
    <OnboardingShell currentScreen={screen} totalScreens={3} nav={
      <OnboardingNav
        showBack={screen > 1}
        onBack={() => setScreen(screen === 3 ? 2 : 1)}
        onContinue={continueStep}
        canContinue={canContinue}
        isLoading={loading}
        continueLabel={screen === 3 ? "Continue to my dashboard" : "Continue"}
        continueTestId="button-onboarding-continue"
      />
    }>
      {screen === 1 && (
        <section className="space-y-6" data-testid="screen-onboarding-welcome">
          <div className="inline-flex items-center gap-2 rounded-full bg-green/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-green">TALA · your wealth companion</div>
          <div>
            <p className="text-sm font-medium text-ink-40">A clearer next step starts here.</p>
            <h1 className="mt-2 font-display text-[34px] leading-tight font-semibold tracking-[-0.03em] text-forest">
              Welcome{clientName ? `, ${clientName.split(" ")[0]}` : ""}.
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-60">
              Your advisor has brought your starting picture together. We’ll help you get oriented, then move at your pace.
            </p>
          </div>
          <div className="rounded-[24px] border border-hairline bg-surface p-5 shadow-[0_2px_14px_rgba(20,52,42,.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-40">Guided by your advisor</p>
            <p className="mt-1 font-display text-xl font-semibold text-forest" data-testid="text-onboarding-advisor">
              {checklist.isLoading ? "Loading your advisor…" : advisor || "Your advisor"}
            </p>
            {checklist.isError && <div className="mt-2 flex items-center justify-between gap-3 text-sm text-clay-ink"><p role="status">Your setup summary is temporarily unavailable.</p><button type="button" onClick={() => void checklist.refetch()} data-testid="button-retry-onboarding-summary" className="shrink-0 font-semibold text-green underline underline-offset-2">Try again</button></div>}
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
              {[
                ["Advised plans", checklist.data?.setupSummary.visiblePlans],
                ["Goals", checklist.data?.setupSummary.activeGoals],
                ["Budget months", checklist.data?.setupSummary.budgetMonths],
              ].map(([label, value]) => (
                <div key={label} data-testid={`summary-${String(label).toLowerCase().replaceAll(" ", "-")}`}>
                  <div className="font-display text-2xl font-semibold text-forest tabular-nums">{checklist.isLoading || checklist.isError ? "—" : value ?? 0}</div>
                  <div className="mt-1 text-xs leading-tight text-ink-40">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-40">Your advisor’s view is a starting point. You can add or update details any time.</p>
        </section>
      )}
      {screen === 2 && (
        <section className="space-y-5" data-testid="screen-onboarding-basics">
          <div>
            <p className="text-sm font-medium text-green">About you</p>
            <h1 className="mt-1 font-display text-[30px] leading-tight font-semibold tracking-[-0.03em] text-forest">Let’s make this yours.</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-60">These details help personalise your experience. Your birth date is month and year only.</p>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-forest">
              Full name
              <input data-testid="input-client-full-name" autoComplete="name" value={draft.fullName} onChange={e => setDraft({ ...draft, fullName: e.target.value })} className="mt-1.5 min-h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-[15px] font-normal text-forest outline-none focus:border-green focus:ring-2 focus:ring-green/15" />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-forest">Date of birth</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <label className="sr-only" htmlFor="birth-month">Birth month</label>
                <select id="birth-month" data-testid="select-birth-month" value={draft.birthMonth} onChange={e => setDraft({ ...draft, birthMonth: e.target.value })} className="min-h-12 rounded-xl border border-hairline bg-surface px-3 text-sm text-forest outline-none focus:border-green focus:ring-2 focus:ring-green/15">
                  <option value="">Month</option>{availableBirthMonths.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <label className="sr-only" htmlFor="birth-year">Birth year</label>
                <select id="birth-year" data-testid="select-birth-year" value={draft.birthYear} onChange={e => setDraft({ ...draft, birthYear: e.target.value })} className="min-h-12 rounded-xl border border-hairline bg-surface px-3 text-sm text-forest outline-none focus:border-green focus:ring-2 focus:ring-green/15">
                  <option value="">Year</option>{years.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
            </fieldset>
            <label className="block text-sm font-semibold text-forest">
              Country of residence
              <select data-testid="select-country-residence" value={draft.countryCode} onChange={e => setDraft({ ...draft, countryCode: e.target.value })} className="mt-1.5 min-h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm font-normal text-forest outline-none focus:border-green focus:ring-2 focus:ring-green/15">
                <option value="">Choose a country</option>{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-hairline bg-surface px-4 text-sm font-medium text-forest">
              I’m an expat
              <input data-testid="toggle-expat" type="checkbox" checked={draft.isExpat} onChange={e => setDraft({ ...draft, isExpat: e.target.checked })} className="h-5 w-5 accent-[var(--green)]" />
            </label>
            <label className="block text-sm font-semibold text-forest">
              Preferred currency
              <select data-testid="select-preferred-currency" value={draft.preferredCurrency} onChange={e => setDraft({ ...draft, preferredCurrency: e.target.value })} className="mt-1.5 min-h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm font-normal text-forest outline-none focus:border-green focus:ring-2 focus:ring-green/15">
                {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
          </div>
        </section>
      )}
      {screen === 3 && (
        <section className="space-y-5" data-testid="screen-onboarding-first-focus">
          <div>
            <p className="text-sm font-medium text-green">Your first step</p>
            <h1 className="mt-1 font-display text-[30px] leading-tight font-semibold tracking-[-0.03em] text-forest">What do you want to sort out first?</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-60">There’s no wrong answer. This simply helps your advisor focus the conversation.</p>
          </div>
          <div className="space-y-2.5" role="radiogroup" aria-label="Choose your first focus">
            {FOCI.map(option => (
              <button key={option.value} type="button" role="radio" aria-checked={focus === option.value} data-testid={`option-first-focus-${option.value}`} onClick={() => setFocus(option.value)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${focus === option.value ? "border-green bg-green/5 ring-2 ring-green/15" : "border-hairline bg-surface hover:border-green/50"}`}>
                <span className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${focus === option.value ? "border-green bg-green" : "border-hairline"}`}>
                    {focus === option.value && <span className="h-2 w-2 rounded-full bg-paper" />}
                  </span>
                  <span><span className="block text-sm font-semibold text-forest">{option.title}</span><span className="mt-1 block text-xs leading-relaxed text-ink-40">{option.description}</span></span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </OnboardingShell>
  );
}
