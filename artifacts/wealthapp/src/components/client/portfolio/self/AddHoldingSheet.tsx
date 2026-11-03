import { useState } from "react";
import { ChevronLeft, TrendingUp, BarChart3, FolderHeart, Bitcoin, Coins, FileText, Home, Landmark, Shield, MoreHorizontal } from "lucide-react";
import BottomSheet from "@/components/client/BottomSheet";
import { getHoldingTypeConfig, HOLDING_TYPE_CONFIG } from "@/lib/holdingTypeConfig";
import StockEtfForm from "./HoldingTypeForm/StockEtfForm";
import EtfForm from "./HoldingTypeForm/EtfForm";
import MutualFundForm from "./HoldingTypeForm/MutualFundForm";
import CryptoForm from "./HoldingTypeForm/CryptoForm";
import CommodityForm from "./HoldingTypeForm/CommodityForm";
import BondForm from "./HoldingTypeForm/BondForm";
import PropertyForm from "./HoldingTypeForm/PropertyForm";
import CashForm from "./HoldingTypeForm/CashForm";
import PensionForm from "./HoldingTypeForm/PensionForm";
import OtherForm from "./HoldingTypeForm/OtherForm";
import { cn } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: Record<string, unknown>) => Promise<void>;
}

const ICON_MAP: Record<string, React.ElementType> = {
  stock_etf: TrendingUp,
  etf: BarChart3,
  mutual_fund: FolderHeart,
  crypto: Bitcoin,
  commodity: Coins,
  bond: FileText,
  property: Home,
  cash: Landmark,
  pension: Shield,
  other: MoreHorizontal,
};

export default function AddHoldingSheet({ isOpen, onClose, onAdd }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  function handleClose() {
    setSelectedType(null);
    onClose();
  }

  async function handleSubmit(data: Record<string, unknown>) {
    await onAdd(data);
    setSelectedType(null);
    onClose();
  }

  const formProps = selectedType ? { initial: undefined, onSubmit: handleSubmit, submitLabel: "Add investment" } : null;

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Add an investment" height="full">
      {!selectedType ? (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-40 pb-1">Live prices are fetched automatically for market-linked investments.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {HOLDING_TYPE_CONFIG.map(cfg => (
              <button
                key={cfg.type}
                onClick={() => setSelectedType(cfg.type)}
                className={cn(
                  "flex flex-col items-start gap-2 p-4 rounded-[24px] bg-surface hover:bg-breeze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green transition-colors text-left"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  {(() => {
                    const Icon = ICON_MAP[cfg.type] || MoreHorizontal;
                    return (
                      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-field text-forest">
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </span>
                    );
                  })()}
                  {cfg.priceSource === "api" && (
                    <span className="text-[10px] font-semibold tracking-[0.08em] text-paper bg-forest px-2 py-0.5 rounded-full">LIVE</span>
                  )}
                </div>
                <span className="text-[14px] font-semibold text-forest">{cfg.label}</span>
                <span className="text-[12px] text-ink-40 leading-snug">{cfg.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedType(null)} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-green mb-3 hover:text-forest-700">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <p className="text-[16px] font-semibold text-forest mb-4">{getHoldingTypeConfig(selectedType).label}</p>
          {selectedType === "stock_etf" && <StockEtfForm {...formProps!} />}
          {selectedType === "etf" && <EtfForm {...formProps!} />}
          {selectedType === "mutual_fund" && <MutualFundForm {...formProps!} />}
          {selectedType === "crypto" && <CryptoForm {...formProps!} />}
          {selectedType === "commodity" && <CommodityForm {...formProps!} />}
          {selectedType === "bond" && <BondForm {...formProps!} />}
          {selectedType === "property" && <PropertyForm {...formProps!} />}
          {selectedType === "cash" && <CashForm {...formProps!} />}
          {selectedType === "pension" && <PensionForm {...formProps!} />}
          {selectedType === "other" && <OtherForm {...formProps!} />}
        </div>
      )}
    </BottomSheet>
  );
}
