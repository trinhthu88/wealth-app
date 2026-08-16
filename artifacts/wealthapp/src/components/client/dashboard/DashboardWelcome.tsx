import { useState } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

interface Props {
  isTrackA?: boolean;
  advisorName?: string | null;
}

export default function DashboardWelcome({ isTrackA = false, advisorName }: Props) {
  const { profile } = useProfile();
  const firstName = (profile?.fullName ?? "").split(" ")[0] || "there";
  const [chipDismissed, setChipDismissed] = useState(() =>
    sessionStorage.getItem("advisor_chip_dismissed") === "1"
  );

  function dismissChip() {
    setChipDismissed(true);
    sessionStorage.setItem("advisor_chip_dismissed", "1");
  }

  const initials = (advisorName ?? "")
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
      <h1 className="text-2xl font-semibold text-[#042C53]">
        {greeting()}, {firstName}
      </h1>
      <div className="flex flex-col items-start sm:items-end gap-1.5">
        <p className="text-sm text-[#64748B]">{formatDate()}</p>
        {isTrackA && advisorName && !chipDismissed && (
          <Link href="/client/messages">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1D9E75]/10 rounded-full cursor-pointer hover:bg-[#1D9E75]/15 transition-colors">
              <div className="h-5 w-5 rounded-full bg-[#1D9E75] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                {initials}
              </div>
              <span className="text-xs font-medium text-[#1D9E75]">Your advisor: {advisorName}</span>
              <button
                onClick={e => { e.preventDefault(); dismissChip(); }}
                aria-label="Dismiss advisor chip"
                className="text-[#1D9E75]/60 hover:text-[#1D9E75] ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
