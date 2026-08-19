import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import BottomNav from "@/components/BottomNav";
import Sol from "@/components/Sol";
import { MILESTONES, getEarnedMilestones, getStreak } from "@/lib/milestones";
import { Target, Flame } from "lucide-react";

export default function MilestonesPage() {
  const [earnedKeys, setEarnedKeys] = useState<string[]>([]);
  const [streakWeeks, setStreakWeeks] = useState(0);

  useEffect(() => {
    setEarnedKeys(getEarnedMilestones());
    setStreakWeeks(getStreak().weeks);
  }, []);

  const earned = MILESTONES.filter(m => earnedKeys.includes(m.key));
  const locked = MILESTONES.filter(m => !earnedKeys.includes(m.key));

  const streakBadges = ["streak_4", "streak_12"];
  const isStreakBadge = (key: string) => streakBadges.includes(key);

  return (
    <AppShell>
      <div className="pb-24 md:pb-0">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 700, color: "#042C53", letterSpacing: "-0.02em" }}>
            Milestones
          </h1>
          {streakWeeks > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: "#FEF3D6" }}
            >
              <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#C8881C" }}>
                {streakWeeks} weeks
              </span>
            </div>
          )}
        </div>

        {/* Streak card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-[22px] mb-5"
          style={{ background: "linear-gradient(135deg, #042C53, #0A3A6B)", padding: 20 }}
        >
          {/* Decorative dots */}
          <div style={{ position: "absolute", top: 12, right: 60, width: 8, height: 8, borderRadius: "50%", background: "#F5B947", opacity: 0.7 }} />
          <div style={{ position: "absolute", top: 28, right: 40, width: 5, height: 5, borderRadius: "50%", background: "#1D9E75", opacity: 0.6 }} />
          <div style={{ position: "absolute", bottom: 16, right: 70, width: 6, height: 6, borderRadius: "50%", background: "#D86B5A", opacity: 0.5 }} />

          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <Sol size="sm" animate="idle" showFace />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: "white", lineHeight: 1.3 }}>
                {streakWeeks > 0 ? `${streakWeeks}-week streak` : "Start your streak"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4, lineHeight: 1.45 }}>
                {streakWeeks >= 4
                  ? "You're in the top 20% for consistency. Keep it up."
                  : streakWeeks > 0
                  ? `${4 - streakWeeks} more week${4 - streakWeeks !== 1 ? "s" : ""} to unlock the 4-week badge.`
                  : "Check in weekly to build your streak and unlock badges."}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Earned badges */}
        {earned.length > 0 && (
          <div className="mb-6">
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: "#042C53", margin: 0, marginBottom: 10 }}>
              Earned · {earned.length} of {MILESTONES.length}
            </h2>
            <div className="grid grid-cols-3 gap-[10px]">
              {earned.map(m => (
                <motion.div
                  key={m.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-[20px] text-center"
                  style={{ padding: "12px 8px", boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}
                >
                  <div
                    className="mx-auto flex items-center justify-center rounded-[12px] mb-2"
                    style={{
                      width: 52, height: 52,
                      background: isStreakBadge(m.key) ? "#FEF3D6" : "#E6F5EE",
                    }}
                  >
                    <Target className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#042C53", lineHeight: 1.3 }}>{m.label}</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1D9E75", marginTop: 3 }}>
                    Earned
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* In-progress: closest badges */}
        {locked.slice(0, 3).length > 0 && (
          <div className="mb-6">
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: "#042C53", margin: 0, marginBottom: 10 }}>
              Almost there
            </h2>
            <div className="grid grid-cols-3 gap-[10px]">
              {locked.slice(0, 3).map(m => (
                <div
                  key={m.key}
                  className="rounded-[20px] text-center"
                  style={{ padding: "12px 8px", background: "#FEF3D6", border: "1.5px dashed #F5B947", boxShadow: "0 2px 8px rgba(200,136,28,0.1)" }}
                >
                  <div
                    className="mx-auto flex items-center justify-center rounded-[12px] mb-2"
                    style={{ width: 52, height: 52, background: "rgba(245,185,71,0.2)" }}
                  >
                    <Target className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#C8881C", lineHeight: 1.3 }}>{m.label}</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C8881C", marginTop: 3 }}>
                    Not yet
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked badges */}
        {locked.slice(3).length > 0 && (
          <div>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: "#042C53", margin: 0, marginBottom: 10 }}>
              Locked · {locked.slice(3).length} more
            </h2>
            <div className="grid grid-cols-3 gap-[10px]">
              {locked.slice(3).map(m => (
                <div
                  key={m.key}
                  className="bg-white rounded-[20px] text-center"
                  style={{ padding: "12px 8px", boxShadow: "0 4px 14px rgba(15,23,42,0.04)", opacity: 0.45 }}
                >
                  <div
                    className="mx-auto flex items-center justify-center rounded-[12px] mb-2"
                    style={{ width: 52, height: 52, background: "#F2EFE9" }}
                  >
                    <Target className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#042C53", lineHeight: 1.3 }}>{m.label}</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8A095", marginTop: 3 }}>
                    Locked
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty earned state */}
        {earned.length === 0 && (
          <div className="text-center py-4">
            <Sol size="md" animate="idle" showFace className="mx-auto mb-4" />
            <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: "#042C53", marginBottom: 6 }}>
              Your badges await
            </p>
            <p style={{ fontSize: 13, color: "#A8A095", maxWidth: 220, margin: "0 auto 20px", lineHeight: 1.5 }}>
              Complete your pathway and track your budget to earn your first badge.
            </p>
            {/* Preview of first earnable badges */}
            <div className="grid grid-cols-3 gap-[10px] mt-2">
              {MILESTONES.slice(0, 3).map(m => (
                <div key={m.key} className="bg-white rounded-[20px] text-center" style={{ padding: "12px 8px", boxShadow: "0 4px 14px rgba(15,23,42,0.04)", opacity: 0.5 }}>
                  <div className="mx-auto flex items-center justify-center rounded-[12px] mb-2" style={{ width: 52, height: 52, background: "#F2EFE9" }}>
                    <Target className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#042C53", lineHeight: 1.3 }}>{m.label}</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8A095", marginTop: 3 }}>Earn it</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </AppShell>
  );
}
