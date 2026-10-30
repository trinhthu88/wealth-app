import { Link } from "wouter";
import Sol from "@/components/Sol";

export default function BillingCancel() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <Sol size="lg" animate="idle" showFace />
      <h1 className="font-display text-[22px] font-bold text-forest tracking-[-0.02em]">
        No problem — you can upgrade any time.
      </h1>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-xl bg-green text-white text-[15px] font-semibold px-6 h-12 hover:bg-forest-700 transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
