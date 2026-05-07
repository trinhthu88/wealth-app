import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import PublicNav from "@/components/PublicNav";
import {
  TrendingUp, Shield, Target, BarChart3, Heart, Users,
  ArrowRight, CheckCircle, Globe, Star, ChevronDown
} from "lucide-react";

const FEATURES = [
  { icon: Target, title: "Goal Planning", desc: "Set, track and achieve every financial milestone with structured goal frameworks." },
  { icon: BarChart3, title: "Portfolio Insights", desc: "Visualize your multi-asset portfolio with real-time allocation charts." },
  { icon: Heart, title: "Financial Health Score", desc: "Get your personalized financial wellness score and actionable improvements." },
  { icon: Shield, title: "KYC & Compliance", desc: "Secure document management with advisor-verified KYC workflows." },
  { icon: Users, title: "Advisor Portal", desc: "Boutique advisory with dedicated advisor access to manage your plan." },
  { icon: Globe, title: "Expat-Friendly", desc: "Multi-currency support built for Southeast Asian expats and locals alike." },
];

const TESTIMONIALS = [
  { name: "Sarah L.", role: "Expat in Singapore", quote: "WealthApp finally gave me clarity on my investments across three countries.", stars: 5 },
  { name: "Marcus T.", role: "Investment Client", quote: "My advisor and I use the same platform — it's seamless and transparent.", stars: 5 },
  { name: "Priya K.", role: "Free User", quote: "The compound interest calculator alone saved me thousands in mortgage decisions.", stars: 5 },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#042C53] to-[#0a4a7a] text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #1D9E75 0%, transparent 50%), radial-gradient(circle at 80% 20%, #1D9E75 0%, transparent 50%)" }} />
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-medium mb-8 border border-white/20">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            Boutique Advisory for Southeast Asia
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
            Your Wealth,<br />
            <span className="text-[#1D9E75]">Your Plan.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/75 max-w-2xl mx-auto mb-10">
            WealthApp is the all-in-one financial planning platform for expats and investors across Southeast Asia — with boutique advisory, smart tools, and a clear pathway to financial independence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="bg-[#1D9E75] hover:bg-[#178a65] text-white border-0 px-8 shadow-lg">
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/tools">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 bg-transparent px-8">
                Try Free Tools
              </Button>
            </Link>
          </div>
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-white/60">
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-[#1D9E75]" /> No credit card needed</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-[#1D9E75]" /> Start in 2 minutes</span>
            <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-[#1D9E75]" /> Upgrade anytime</span>
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce text-white/40">
          <ChevronDown className="h-6 w-6" />
        </div>
      </section>

      {/* Stats */}
      <section className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Active Users", value: "2,400+" },
            { label: "Assets Tracked", value: "$180M+" },
            { label: "Countries", value: "12" },
            { label: "Avg. Savings Growth", value: "23%" },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold text-primary">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">Everything You Need to Build Wealth</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">From budgeting to boutique advisory — all in one beautifully simple platform.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-card border border-card-border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/50 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Loved by Investors Across SEA</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-card border border-card-border rounded-xl p-6">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.stars }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="bg-gradient-to-br from-[#042C53] to-[#0a4a7a] rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Take Control of Your Finances?</h2>
          <p className="text-white/70 mb-8 max-w-lg mx-auto">Join thousands of expats and investors who have transformed their financial lives with WealthApp.</p>
          <div className="flex gap-3 justify-center flex-col sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg" className="bg-[#1D9E75] hover:bg-[#178a65] text-white border-0 px-8">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/tools">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 bg-transparent">
                Try Our Tools First
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <TrendingUp className="h-3 w-3 text-white" />
            </div>
            WealthApp
          </div>
          <div className="flex gap-6">
            <Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link>
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <Link href="/sign-in" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <div>© 2026 WealthApp. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
