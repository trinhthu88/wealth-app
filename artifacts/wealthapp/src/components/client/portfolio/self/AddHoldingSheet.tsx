import { useState } from "react";
import { ChevronLeft } from "lucide-react";
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

const EMOJI_MAP: Record<string, string> = {
  stock_etf: "📈",
  etf: "📊",
  mutual_fund: "🗂️",
  crypto: "₿",
  commodity: "🪙",
  bond: "📄",
  property: "🏠",
  cash: "🏦",
  pension: "🛡",
  other: "···",
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
          <p className="text-xs text-slate-500 pb-1">Live prices are fetched automatically for market-linked investments.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {HOLDING_TYPE_CONFIG.map(cfg => (
              <button
                key={cfg.type}
                onClick={() => setSelectedType(cfg.type)}
                className={cn(
                  "flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 border-slate-200 hover:border-[#1D9E75]/50 transition-all text-left",
                  cfg.color
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xl">{EMOJI_MAP[cfg.type] ?? "💼"}</span>
                  {cfg.priceSource === "api" && (
                    <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full">LIVE</span>
                  )}
                </div>
                <span className={cn("text-xs font-semibold", cfg.textColor)}>{cfg.label}</span>
                <span className="text-[11px] text-slate-500 leading-tight">{cfg.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedType(null)} className="flex items-center gap-1.5 text-sm text-[#1D9E75] mb-5 hover:text-[#0F6E56]">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <p className="text-base font-semibold text-[#042C53] mb-4">{getHoldingTypeConfig(selectedType).label}</p>
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
