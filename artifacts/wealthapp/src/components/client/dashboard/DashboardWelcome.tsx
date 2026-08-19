import { useProfile } from "@/hooks/useProfile";

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
}

interface Props {
  isTrackA?: boolean;
  advisorName?: string | null;
}

export default function DashboardWelcome({ isTrackA = false, advisorName }: Props) {
  const { profile, update } = useProfile();
  const firstName = (profile?.fullName ?? "").split(" ")[0] || "there";

  const currency = profile?.preferredCurrency ?? "USD";
  const toggleCurrency = () => {
    update.mutate({ preferredCurrency: currency === "USD" ? "VND" : "USD" });
  };

  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#1D9E75] mb-1.5">
          {formatDate()}
        </div>
        <h1 className="font-display text-[22px] font-bold text-[#042C53] tracking-[-0.02em]">
          {greeting()}, {firstName}
        </h1>
      </div>
      <button
        onClick={toggleCurrency}
        className="shrink-0 min-h-[44px] px-3.5 rounded-full border border-[#E6E1D8] bg-white font-mono text-[11px] font-medium text-[#042C53] cursor-pointer hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors"
      >
        {currency}
      </button>
    </div>
  );
}
