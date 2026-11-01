interface OnboardingShellProps {
  currentScreen: number;
  totalScreens: number;
  children: React.ReactNode;
  nav: React.ReactNode;
}

export default function OnboardingShell({ currentScreen, totalScreens, children, nav }: OnboardingShellProps) {
  return (
    <div className="min-h-[100dvh] bg-paper pb-24 md:pb-0" data-testid="client-onboarding-shell">
      <div className="max-w-[480px] mx-auto px-5 py-6 md:py-12">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-40 mb-6" aria-live="polite" data-testid="text-onboarding-progress">
          Step {currentScreen} of {totalScreens}
        </div>
        
        {children}
        
        <div className="mt-10">
          {nav}
        </div>
      </div>
    </div>
  );
}
