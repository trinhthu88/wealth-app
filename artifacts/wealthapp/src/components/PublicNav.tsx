import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useUser, UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";
import Sol from "./Sol";

function SolWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Sol size="xs" animate="idle" showRays={false} />
      <span className="font-display text-[24px] font-semibold tracking-[-0.02em] text-forest">
        tala
      </span>
    </div>
  );
}

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const { isSignedIn } = useUser();
  const { profile } = useProfile();

  const dashLink = !profile ? "/free/dashboard"
    : profile.role === "super_admin" ? "/admin/dashboard"
    : profile.role === "advisor" ? "/advisor/dashboard"
    : profile.role === "investment_client" ? "/client/dashboard"
    : "/free/dashboard";

  return (
    <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur-sm border-b border-hairline">
      <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <Link href="/" className="hover:opacity-85 transition-opacity">
          <SolWordmark />
        </Link>

        <div className="hidden md:flex items-center gap-8 text-[15px] font-semibold text-ink-40">
          <Link href="/tools" className="hover:text-forest transition-colors">Free Tools</Link>
          <Link href="/blog" className="hover:text-forest transition-colors">Insights</Link>
          {isSignedIn ? (
            <>
              <Link href={dashLink} className="hover:text-green transition-colors">My Dashboard</Link>
              <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/sign-in" className="text-forest hover:text-green transition-colors">
                Sign In
              </Link>
              <Link href="/sign-up" className="bg-green text-white px-5 py-2.5 rounded-xl hover:bg-forest transition-colors">
                Get Started
              </Link>
            </div>
          )}
        </div>

        <button className="md:hidden text-forest p-2 -mr-2" onClick={() => setOpen(v => !v)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-hairline bg-surface px-6 py-4 space-y-2 shadow-lg absolute left-0 right-0">
          <Link href="/tools" className="block py-3 text-[16px] font-semibold text-forest" onClick={() => setOpen(false)}>Free Tools</Link>
          <Link href="/blog" className="block py-3 text-[16px] font-semibold text-forest" onClick={() => setOpen(false)}>Insights</Link>
          {isSignedIn ? (
            <Link href={dashLink} className="block py-3 text-[16px] font-semibold text-green" onClick={() => setOpen(false)}>My Dashboard</Link>
          ) : (
            <div className="pt-4 flex flex-col gap-3">
              <Link href="/sign-in" className="flex items-center justify-center w-full h-12 rounded-xl border border-hairline text-forest font-semibold" onClick={() => setOpen(false)}>
                Sign In
              </Link>
              <Link href="/sign-up" className="flex items-center justify-center w-full h-12 rounded-xl bg-green text-white font-semibold" onClick={() => setOpen(false)}>
                Get Started Free
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}