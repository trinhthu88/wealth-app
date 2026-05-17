import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const REWARDS = {
  1: { emoji: "✨", bg: "from-primary/5 to-teal-50" },
  2: { emoji: "🎯", bg: "from-blue-50 to-indigo-50" },
  3: { emoji: "🎉", bg: "from-amber-50 to-orange-50" },
};

interface Props {
  rewardNumber: 1 | 2 | 3;
  title: string;
  description: string;
  onDismiss: () => void;
}

export default function RewardReveal({ rewardNumber, title, description, onDismiss }: Props) {
  const reward = REWARDS[rewardNumber];

  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
      >
        <motion.div
          className={`bg-gradient-to-br ${reward.bg} border border-border rounded-3xl p-8 text-center max-w-sm w-full shadow-xl`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
        >
          <div className="text-6xl mb-4">{reward.emoji}</div>
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-muted-foreground text-base">{description}</p>
          <p className="text-xs text-muted-foreground mt-6">Tap anywhere to continue</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
