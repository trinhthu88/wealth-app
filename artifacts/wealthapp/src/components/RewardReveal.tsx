import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sol from "@/components/Sol";

interface Props {
  rewardNumber: 1 | 2 | 3;
  title: string;
  description: string;
  onDismiss: () => void;
}

export default function RewardReveal({ title, description, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        <motion.div
          className="bg-card border border-primary/20 rounded-3xl p-8 text-center max-w-sm w-full shadow-xl"
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ duration: 0.35, type: "spring", stiffness: 220, damping: 18 }}
        >
          <div className="flex justify-center mb-5">
            <Sol size="lg" animate="float" showFace />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">{title}</h2>
          <p className="text-muted-foreground text-base">{description}</p>
          <p className="text-xs text-muted-foreground mt-6">Tap anywhere to continue</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
