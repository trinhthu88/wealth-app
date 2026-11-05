import type { ReactNode } from "react";
import { toast } from "sonner";
import type { CheckpointCode } from "@workspace/tier-policy";
import { useCreateLeadFromInterest } from "@/hooks/useCreateLeadFromInterest";
import { track } from "@/lib/analytics";

interface Props {
  source: CheckpointCode;
  location: string;
  className?: string;
  children?: ReactNode;
}

/** The single upgrade control: raises the user's hand, and the advisor card shows what happens next. */
export default function TalkToAdvisorButton({ source, location, className, children = "Talk to an advisor" }: Props) {
  const createLead = useCreateLeadFromInterest();
  return (
    <button
      type="button"
      disabled={createLead.isPending}
      className={className}
      onClick={() => {
        track("upgrade_cta_clicked", { location, action: "interest", source });
        createLead.mutate(source, {
          onSuccess: () => toast.success("Thanks. We're matching you with an advisor."),
          onError: () => toast.error("We couldn't send that just yet. Please try again."),
        });
      }}
    >
      {children}
    </button>
  );
}
