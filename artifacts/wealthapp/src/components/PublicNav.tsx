import { Link } from "wouter";
import { TrendingUp, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser, UserButton } from "@clerk/react";
import { useProfile } from "@/hooks/useProfile";

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
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground hover:opacity-90 transition-opacity">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          WealthApp
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
              <Link href="/sign-in"><Button variant="ghost" size="sm">Sign In</Button></Link>
              <Link href="/sign-up"><Button size="sm">Get Started</Button></Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(v => !v)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-2">
          <Link href="/tools" className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>Free Tools</Link>
          <Link href="/blog" className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>Insights</Link>
          {isSignedIn ? (
            <Link href={dashLink} className="block py-2 text-sm font-medium" onClick={() => setOpen(false)}>My Dashboard</Link>
          ) : (
            <>
              <Link href="/sign-in"><Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>Sign In</Button></Link>
              <Link href="/sign-up"><Button className="w-full" onClick={() => setOpen(false)}>Get Started Free</Button></Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
