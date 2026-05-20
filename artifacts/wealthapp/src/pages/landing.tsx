import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import PublicNav from "@/components/PublicNav";
import {
  ArrowRight, CheckCircle, Star,
  Target, BarChart3, Heart, Shield, Users, Globe,
} from "lucide-react";

const FEATURES = [
  { icon: Target, title: "Goal Planning", desc: "Set, track and achieve every financial milestone with structured goal frameworks." },
  { icon: BarChart3, title: "Portfolio Insights", desc: "Visualize your multi-asset portfolio with real-time allocation charts." },
  { icon: Heart, title: "Financial Health Score", desc: "Get your personalized financial wellness score and actionable improvements." },
  { icon: Shield, title: "KYC & Compliance", desc: "Secure document management with advisor-verified KYC workflows." },
  { icon: Users, title: "Advisor Portal", desc: "Boutique advisory with a dedicated advisor managing your plan alongside you." },
  { icon: Globe, title: "Expat-Friendly", desc: "Multi-currency support built for Southeast Asian expats and professionals." },
];

const TESTIMONIALS = [
  { name: "Sarah L.", role: "Expat in Singapore", quote: "TALA finally gave me clarity on my investments across three countries.", stars: 5 },
  { name: "Marcus T.", role: "Investment Client", quote: "My advisor and I use the same platform — it's seamless and transparent.", stars: 5 },
  { name: "Priya K.", role: "Free User", quote: "The scenario planner alone changed how I think about my mortgage.", stars: 5 },
];

function SolHero() {
  return (
    <svg width="200" height="200" viewBox="0 0 220 220" fill="none" aria-hidden="true">
      <circle cx="24" cy="32" r="3.5" fill="#F5B947" />
      <circle cx="198" cy="48" r="2.5" fill="#1D9E75" />
      <rect x="186" y="26" width="7" height="7" fill="#D86B5A" transform="rotate(35 189 29)" />
      <circle cx="18" cy="178" r="3" fill="#4A7CB8" />
      <circle cx="196" cy="180" r="2.5" fill="#F5B947" />
      <g stroke="#F5B947" strokeWidth="4.5" strokeLinecap="round">
        <line x1="110" y1="38" x2="110" y2="14" />
        <line x1="110" y1="184" x2="110" y2="208" />
        <line x1="38" y1="110" x2="14" y2="110" />
        <line x1="182" y1="110" x2="206" y2="110" />
        <line x1="57" y1="57" x2="41" y2="41" />
        <line x1="163" y1="57" x2="179" y2="41" />
        <line x1="57" y1="163" x2="41" y2="179" />
        <line x1="163" y1="163" x2="179" y2="179" />
      </g>
      <circle cx="110" cy="110" r="58" fill="#F5B947" />
      <circle cx="84" cy="122" r="9" fill="#D86B5A" opacity="0.55" />
      <circle cx="136" cy="122" r="9" fill="#D86B5A" opacity="0.55" />
      <path d="M88 100Q96 91 104 100" stroke="#042C53" strokeWidth="3.8" fill="none" strokeLinecap="round" />
      <path d="M116 100Q124 91 132 100" stroke="#042C53" strokeWidth="3.8" fill="none" strokeLinecap="round" />
      <ellipse cx="110" cy="128" rx="9" ry="10" fill="#042C53" />
      <line x1="52" y1="88" x2="30" y2="62" stroke="#042C53" strokeWidth="4" strokeLinecap="round" />
      <line x1="168" y1="88" x2="190" y2="62" stroke="#042C53" strokeWidth="4" strokeLinecap="round" />
      <circle cx="30" cy="62" r="6" fill="#042C53" />
      <circle cx="190" cy="62" r="6" fill="#042C53" />
    </svg>
  );
}

function SolSmile() {
  return (
    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke="#1D9E75" strokeWidth="5" strokeLinecap="round">
        <line x1="50" y1="8" x2="50" y2="17" />
        <line x1="50" y1="83" x2="50" y2="92" />
        <line x1="8" y1="50" x2="17" y2="50" />
        <line x1="83" y1="50" x2="92" y2="50" />
        <line x1="21" y1="21" x2="28" y2="28" />
        <line x1="72" y1="72" x2="79" y2="79" />
        <line x1="79" y1="21" x2="72" y2="28" />
        <line x1="28" y1="72" x2="21" y2="79" />
      </g>
      <circle cx="50" cy="50" r="24" fill="#1D9E75" />
      <circle cx="41" cy="47" r="3" fill="white" />
      <circle cx="59" cy="47" r="3" fill="white" />
      <path d="M41 58 Q50 66 59 58" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-sidebar">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 15% 85%, hsl(var(--primary)) 0%, transparent 45%), radial-gradient(circle at 85% 15%, hsl(var(--primary)) 0%, transparent 45%)" }} />
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-xs font-mono tracking-widest uppercase text-white/70 mb-8 border border-white/15">
                <Star className="h-3 w-3 text-amber-400" aria-hidden="true" />
                Boutique Advisory · Southeast Asia
              </div>
              <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight tracking-tight text-white mb-6">
                A warm, clever friend<br />
                <span className="text-primary">who gets finance.</span>
              </h1>
              <p className="text-lg text-white/60 max-w-lg mb-10 leading-relaxed">
                TALA is the all-in-one financial platform for professionals building wealth across Southeast Asia — boutique advisory, smart tools, and a clear path forward.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/sign-up">
                  <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground border-0 px-8 font-semibold shadow-lg shadow-primary/30">
                    Get started — it's free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/tools">
                  <Button size="lg" variant="outline" className="rounded-full border-white/25 text-white hover:bg-white/10 bg-transparent px-8 font-medium">
                    Try Free Tools
                  </Button>
                </Link>
              </div>
              <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm text-white/45">
                <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" aria-hidden="true" /> No credit card needed</span>
                <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" aria-hidden="true" /> Start in 2 minutes</span>
                <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" aria-hidden="true" /> Upgrade anytime</span>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-center gap-4">
              <SolHero />
              <div className="font-mono text-[10px] tracking-widest uppercase text-white/25">Sol · Your TALA companion</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Active Users", value: "2,400+" },
            { label: "Assets Tracked", value: "$180M+" },
            { label: "Countries", value: "12" },
            { label: "Avg. Savings Growth", value: "23%" },
          ].map(s => (
            <div key={s.label}>
              <div className="font-display text-3xl font-extrabold text-primary tracking-tight">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <div className="tala-eyebrow mb-3">What TALA does</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 text-foreground">
            Everything you need to build wealth
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">From budgeting to boutique advisory — all in one beautifully simple platform.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all hover:-translate-y-0.5 duration-200">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-display font-bold mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <div className="tala-eyebrow mb-3">What people say</div>
            <h2 className="font-display text-3xl font-bold text-foreground">
              Loved by investors across SEA
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-background border border-border rounded-2xl p-6">
                <div className="flex gap-1 mb-4" aria-label={`${t.stars} out of 5 stars`}>
                  {Array.from({ length: t.stars }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />)}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <SolSmile />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-sm text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="bg-sidebar rounded-3xl p-12 md:p-16 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, hsl(var(--primary)) 0%, transparent 50%)", width: "100%", height: "100%" }} />
          <div className="relative">
            <div className="tala-eyebrow text-white/40 mb-4">Ready to start?</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Take control of your finances.
            </h2>
            <p className="text-white/60 mb-10 max-w-lg mx-auto leading-relaxed">
              Join thousands of expats and investors who have transformed their financial lives with TALA.
            </p>
            <div className="flex gap-3 justify-center flex-col sm:flex-row">
              <Link href="/sign-up">
                <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground border-0 px-8 font-semibold shadow-lg shadow-primary/30">
                  Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/tools">
                <Button size="lg" variant="outline" className="rounded-full border-white/25 text-white hover:bg-white/10 bg-transparent px-8 font-medium">
                  Try Our Tools First
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 100 100" fill="none" aria-hidden="true">
              <circle cx="50" cy="50" r="22" fill="#1D9E75" />
              <g stroke="#1D9E75" strokeWidth="7" strokeLinecap="round">
                <line x1="50" y1="6" x2="50" y2="18" /><line x1="50" y1="82" x2="50" y2="94" />
                <line x1="6" y1="50" x2="18" y2="50" /><line x1="82" y1="50" x2="94" y2="50" />
                <line x1="20" y1="20" x2="27" y2="27" /><line x1="73" y1="73" x2="80" y2="80" />
                <line x1="80" y1="20" x2="73" y2="27" /><line x1="27" y1="73" x2="20" y2="80" />
              </g>
            </svg>
            <span className="font-display font-bold text-foreground">tala</span>
          </div>
          <div className="flex gap-6">
            <Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link>
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <Link href="/sign-in" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <div className="font-mono text-xs">© 2026 TALA. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
