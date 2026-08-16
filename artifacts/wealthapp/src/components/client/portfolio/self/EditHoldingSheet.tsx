import { useState } from "react";
import BottomSheet from "@/components/client/BottomSheet";
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
import type { ClientHolding } from "@/hooks/useClientHoldings";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  holding: ClientHolding | null;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function EditHoldingSheet({ isOpen, onClose, holding, onUpdate, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!holding) return null;

  async function handleUpdate(data: Record<string, unknown>) {
    await onUpdate(holding!.id, data);
    onClose();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(holding!.id);
      onClose();
    } finally { setDeleting(false); setConfirming(false); }
  }

  const formProps = { initial: holding, onSubmit: handleUpdate, submitLabel: "Save changes" };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Edit investment" height="auto">
      {holding.holdingType === "stock_etf" && <StockEtfForm {...formProps} />}
      {holding.holdingType === "etf" && <EtfForm {...formProps} />}
      {holding.holdingType === "mutual_fund" && <MutualFundForm {...formProps} />}
      {holding.holdingType === "crypto" && <CryptoForm {...formProps} />}
      {holding.holdingType === "commodity" && <CommodityForm {...formProps} />}
      {holding.holdingType === "bond" && <BondForm {...formProps} />}
      {holding.holdingType === "property" && <PropertyForm {...formProps} />}
      {holding.holdingType === "cash" && <CashForm {...formProps} />}
      {holding.holdingType === "pension" && <PensionForm {...formProps} />}
      {holding.holdingType === "other" && <OtherForm {...formProps} />}

      <div className="mt-4 pt-4 border-t border-slate-100">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-sm text-red-500 hover:text-red-700 font-medium">
            Delete investment
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Remove this holding? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60">
                {deleting ? "Removing…" : "Yes, remove"}
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
