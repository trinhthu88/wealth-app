import { RefreshCw } from "lucide-react";

export default function SyncedItemBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium"
      title="This value is automatically updated from your portfolio."
    >
      <RefreshCw className="h-2.5 w-2.5" />
      Synced
    </span>
  );
}
