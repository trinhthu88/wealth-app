import TickerHoldingForm from "./TickerHoldingForm";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function StockEtfForm({ initial, onSubmit, submitLabel }: Props) {
  return (
    <TickerHoldingForm
      holdingType="stock_etf"
      symbolType="stock_etf"
      tickerLabel="Ticker symbol"
      tickerPlaceholder="Search stock, e.g. AAPL, TSLA"
      platformLabel="Platform / broker"
      initial={initial}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
    />
  );
}
