import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import Sol from "@/components/Sol";

interface Props {
  rewardNumber: 1 | 2 | 3;
  title: string;
  description: string;
  onDismiss: () => void;
}

/**
 * Full-screen milestone reveal shown between onboarding steps: a Cobalt hero
 * with Sol and a Spring Field accent. Auto-dismisses after 3s or on tap.
 */
export default function RewardReveal({ title, description, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-paper/90 p-5 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        role="status"
        aria-live="polite"
      >
        <motion.div
          className="w-full max-w-sm rounded-[28px] bg-forest p-7 text-center"
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ duration: 0.35, type: "spring", stiffness: 220, damping: 22 }}
        >
          <div className="flex justify-center">
            <Sol size="lg" animate="breathe" showFace />
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-field px-3 py-1 tala-eyebrow text-forest">
            <Sparkles className="h-3.5 w-3.5" />
            Milestone
          </span>
          <h2 className="mt-4 font-display text-[30px] leading-[1.1] text-paper">{title}</h2>
          <p className="mt-3 text-[14px] leading-[1.5] text-mint text-pretty">{description}</p>
          <p className="mt-6 text-[12px] font-medium text-mint/80">Tap anywhere to continue</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
