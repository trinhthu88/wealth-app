import TickerHoldingForm from "./TickerHoldingForm";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function MutualFundForm({ initial, onSubmit, submitLabel }: Props) {
  return (
    <TickerHoldingForm
      holdingType="mutual_fund"
      symbolType="mutual_fund"
      tickerLabel="Fund ticker / symbol"
      tickerPlaceholder="Search fund, e.g. VFIAX, FXAIX"
      platformLabel="Fund provider / platform"
      initial={initial}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
    />
  );
}
