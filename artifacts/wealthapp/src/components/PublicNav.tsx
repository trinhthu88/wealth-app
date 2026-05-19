import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser, UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";

function SolWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="22" fill="#1D9E75" />
        <g stroke="#1D9E75" strokeWidth="6" strokeLinecap="round">
          <line x1="50" y1="6" x2="50" y2="18" />
          <line x1="50" y1="82" x2="50" y2="94" />
          <line x1="6" y1="50" x2="18" y2="50" />
          <line x1="82" y1="50" x2="94" y2="50" />
          <line x1="20" y1="20" x2="28" y2="28" />
          <line x1="72" y1="72" x2="80" y2="80" />
          <line x1="80" y1="20" x2="72" y2="28" />
          <line x1="28" y1="72" x2="20" y2="80" />
        </g>
      </svg>
      <span style={{ fontFamily: "'Sora', sans-serif" }} className="text-xl font-bold tracking-tight text-foreground">
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
    <nav className="sticky top-0 z-50 bg-[#FAF8F5]/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="hover:opacity-85 transition-opacity">
          <SolWordmark />
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/tools" className="hover:text-foreground transition-colors">Free Tools</Link>
          <Link href="/blog" className="hover:text-foreground transition-colors">Insights</Link>
          {isSignedIn ? (
            <>
              <Link href={dashLink} className="hover:text-foreground transition-colors">My Dashboard</Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="font-medium">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="rounded-full px-5 font-semibold">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-foreground/70" onClick={() => setOpen(v => !v)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-[#FAF8F5] px-4 py-4 space-y-2">
          <Link href="/tools" className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>Free Tools</Link>
          <Link href="/blog" className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>Insights</Link>
          {isSignedIn ? (
            <Link href={dashLink} className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>My Dashboard</Link>
          ) : (
            <>
              <Link href="/sign-in"><Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>Sign In</Button></Link>
              <Link href="/sign-up"><Button className="w-full rounded-full font-semibold" onClick={() => setOpen(false)}>Get Started Free</Button></Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
