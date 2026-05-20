import { Link } from "wouter";
import { motion } from "framer-motion";
import Sol from "@/components/Sol";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6 max-w-sm"
      >
        <Sol size="xl" animate="float" showFace />

        <div className="space-y-2">
          <div className="font-mono text-xs tracking-widest uppercase text-muted-foreground">Error 404</div>
          <h1 className="font-display text-3xl font-bold text-foreground">Lost in the sun</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sol searched everywhere but couldn't find this page. It may have moved, or never existed.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link href="/" className="flex-1">
            <Button className="w-full">Back to home</Button>
          </Link>
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full">Go to dashboard</Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
