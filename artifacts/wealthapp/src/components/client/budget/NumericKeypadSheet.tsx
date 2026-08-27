import { Delete } from "lucide-react";
import BottomSheet from "@/components/client/BottomSheet";
import { cn } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

function fmtLive(raw: string): string {
  if (raw === "" || raw === ".") return "0";
  const [whole, frac] = raw.split(".");
  const wholeFmt = (parseInt(whole || "0", 10) || 0).toLocaleString("en-US");
  return frac !== undefined ? `${wholeFmt}.${frac}` : wholeFmt;
}

/**
 * Custom numeric entry — deliberately NOT a native <input>, so the OS
 * on-screen keyboard never appears; digits are appended to a plain string
 * buffer that the parent treats as the live budget-category value.
 */
export default function NumericKeypadSheet({ isOpen, onClose, title, hint, value, onChange, onDone }: Props) {
  function press(key: typeof KEYS[number]) {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "." && value.includes(".")) return;
    if (key === "." && value === "") { onChange("0."); return; }
    // Avoid unbounded leading zeros (e.g. "00").
    if (value === "0" && key !== ".") { onChange(key); return; }
    onChange(value + key);
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="text-center py-2">
          <div className="font-display text-[28px] font-bold text-forest tabular-nums leading-none">
            ${fmtLive(value)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map(key => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className={cn(
                "min-h-14 rounded-2xl text-[20px] font-semibold flex items-center justify-center transition-colors",
                "bg-paper text-forest hover:bg-hairline/60 active:bg-hairline"
              )}
              aria-label={key === "back" ? "Backspace" : key}
            >
              {key === "back" ? <Delete className="h-5 w-5" aria-hidden="true" /> : key}
            </button>
          ))}
        </div>

        <p className="text-[12.5px] text-ink-40 text-center">{hint}</p>

        <button
          type="button"
          onClick={onDone}
          className="w-full min-h-11 rounded-xl bg-green text-white font-semibold text-sm hover:bg-forest-700 transition-colors"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  );
}
