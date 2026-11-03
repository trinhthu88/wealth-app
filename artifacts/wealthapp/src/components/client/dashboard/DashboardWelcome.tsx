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
        <div className="tala-eyebrow text-ink-40 mb-1.5">
          {formatDate()}
        </div>
        <h1 className="font-display text-[34px] leading-[1.05] text-forest tracking-[-0.02em]">
          {greeting()}, {firstName}
        </h1>
      </div>
      <button
        onClick={toggleCurrency}
        className="shrink-0 min-h-[44px] px-3.5 rounded-full border-[1.5px] border-forest bg-transparent text-[12px] font-semibold text-forest cursor-pointer hover:border-forest hover:text-forest transition-colors"
      >
        {currency}
      </button>
    </div>
  );
}
