import TickerHoldingForm from "./TickerHoldingForm";
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  initial?: Partial<ClientHolding>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
}

export default function CommodityForm({ initial, onSubmit, submitLabel }: Props) {
  return (
    <TickerHoldingForm
      holdingType="commodity"
      symbolType="commodity"
      tickerLabel="Commodity symbol"
      tickerPlaceholder="e.g. GC=F (Gold), SI=F (Silver), CL=F (Oil)"
      platformLabel="Platform / broker"
      initial={initial}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
    />
  );
}
