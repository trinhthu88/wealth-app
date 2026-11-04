import { Lock } from "lucide-react";
import { gateMessage, type Capability } from "@workspace/tier-policy";

const TITLES: Record<Capability, string> = {
  goals: "Goals",
  holdings: "Holdings",
  scenarios: "Scenarios",
  sol: "Sol",
  coastPoint: "Coast point",
  advisedPlans: "Advised plans",
  messages: "Messages",
  documents: "Documents",
  plan: "My plan",
};

export default function LockedFeature({ capability }: { capability: Capability }) {
  return (
    <div className="rounded-[24px] bg-surface p-6 text-center" data-testid={`locked-${capability}`}>
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-breeze">
        <Lock className="h-5 w-5 text-forest" aria-hidden="true" />
      </div>
      <h2 className="text-[16px] font-semibold text-forest">{TITLES[capability]}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-40">{gateMessage(capability, null)}</p>
    </div>
  );
}
