import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A persistent, non-dismissible placeholder representing a free user's locked
 * 2nd goal slot. Distinct from SmartUpgradeCard (a dismissible tip/banner) —
 * this is a structural UI element showing what the plan cap is actually hiding.
 */
export default function LockedGoalSlotCard() {
  return (
    <div className="rounded-2xl p-5 grayscale opacity-70" style={{ background: "#F2EFE9", border: "1.5px dashed #D8D2C8" }}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "#E6F5EE" }}>
          <Lock className="h-4 w-4" style={{ color: "#1D9E75" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13, fontWeight: 600, color: "#042C53", lineHeight: 1.4 }}>
            Your 2nd goal slot
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Free plan is limited to 1 goal. Upgrade to track as many as you need.</p>
          <Button variant="outline" size="sm" className="mt-3 text-xs border-primary text-primary hover:bg-primary/5" asChild>
            <a href="/book">Unlock with upgrade →</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
