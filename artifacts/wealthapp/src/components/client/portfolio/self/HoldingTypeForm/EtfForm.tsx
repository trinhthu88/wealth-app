import TickerHoldingForm from "./TickerHoldingForm";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function EtfForm({ initial, onSubmit, submitLabel }: Props) {
  return (
    <TickerHoldingForm
      holdingType="etf"
      symbolType="etf"
      tickerLabel="ETF ticker symbol"
      tickerPlaceholder="Search ETF, e.g. SPY, VOO, QQQ"
      platformLabel="Brokerage platform"
      initial={initial}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
    />
  );
}
