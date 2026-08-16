import TickerHoldingForm from "./TickerHoldingForm";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function BondForm({ initial, onSubmit, submitLabel }: Props) {
  return (
    <TickerHoldingForm
      holdingType="bond"
      symbolType="bond"
      tickerLabel="Bond / ETF ticker"
      tickerPlaceholder="Search bond ETF, e.g. BND, AGG, TLT"
      platformLabel="Platform / broker"
      initial={initial}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
    />
  );
}
