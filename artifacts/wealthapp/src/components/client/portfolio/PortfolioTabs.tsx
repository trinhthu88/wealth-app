import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "holdings", label: "Holdings" },
  { id: "activity", label: "Statement & contribution history" },
];

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function PortfolioTabs({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
            activeTab === tab.id
              ? "bg-white text-[#042C53] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
