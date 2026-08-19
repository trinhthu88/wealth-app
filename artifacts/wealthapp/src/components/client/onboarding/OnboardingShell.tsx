interface OnboardingShellProps {
  currentScreen: number;
  totalScreens: number;
  children: React.ReactNode;
  nav: React.ReactNode;
}

export default function OnboardingShell({ currentScreen, totalScreens, children, nav }: OnboardingShellProps) {
  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-24 md:pb-0">
      <div className="max-w-[480px] mx-auto px-5 py-6 md:py-12">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B6459] mb-6">
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
