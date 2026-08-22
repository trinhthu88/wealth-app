import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Users, ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  fullName: string | null;
  email: string;
  role: string;
  kycStatus: string | null;
  riskProfile: string | null;
  status: string | null;
  onboardingStep: number | null;
  createdAt: string;
  portfolioValue: number;
  plansCount: number;
}

// Only active | paused | churned are ever set now — client_profiles.status
// represents an already-promoted client's account health (see lib/db/src/schema/clients.ts).
// "prospect"/"pending" belonged to the pre-promotion pipeline, which now lives
// entirely on the lead (see leads.ts / the advisor lead-detail page).
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-tint text-green",
  paused: "bg-surface border border-hairline text-ink-60",
  churned: "bg-clay-tint text-clay-ink",
};

const STATUS_FILTERS = ["all", "active", "paused", "churned"];

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function AdvisorClients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["advisor-clients"],
    queryFn: () => apiFetch<Client[]>("/advisor/clients"),
  });

  const filtered = clients.filter(c => {
    const matchesSearch = c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.fullName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAUM = clients.reduce((s, c) => s + c.portfolioValue, 0);

  return (
    <AppShell>
      <PageHeader
        title="My Clients"
        subtitle={`${clients.length} clients · ${fmtUSD(totalAUM)} total AUM`}
        action={
          <Link href="/advisor/leads">
            <Button className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700">
              <Plus className="h-4 w-4 mr-2" /> Add lead
            </Button>
          </Link>
        }
      />

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input placeholder="Search clients by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm h-11 rounded-full border-hairline bg-surface px-5 focus-visible:ring-green" />
        <div className="flex gap-2 flex-wrap items-center">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("text-[13px] px-4 py-2 rounded-full font-medium transition-colors capitalize border",
                statusFilter === s ? "bg-forest text-paper border-forest" : "bg-surface border-hairline text-ink-60 hover:bg-paper")}>
              {s === "all" ? `All (${clients.length})` : `${s} (${clients.filter(c => c.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[72px] bg-surface rounded-[26px] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-[26px] p-16 text-center shadow-[0_2px_14px_rgba(20,52,42,0.06)]">
          <Users className="h-14 w-14 text-ink-20 mx-auto mb-4" />
          <h3 className="font-display text-[20px] font-semibold text-forest mb-2">{search ? "No matching clients" : "No clients yet"}</h3>
          <p className="text-[14px] text-ink-40">{search ? "Try a different search term." : "Clients are promoted from the lead pipeline — add a lead using the button above."}</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[26px] shadow-[0_2px_14px_rgba(20,52,42,0.06)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Client</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline">Status</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell">Risk</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden md:table-cell text-right">Portfolio</th>
                <th className="px-5 py-4 font-sans text-[13px] font-medium text-ink-40 border-b border-hairline hidden lg:table-cell text-right">Plans</th>
                <th className="px-5 py-4 border-b border-hairline" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-paper transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-tint flex items-center justify-center text-[15px] font-semibold text-green shrink-0">
                        {(c.fullName ?? c.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-[15px] text-forest">{c.fullName ?? "—"}</div>
                        <div className="text-[13px] text-ink-40">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("text-[13px] px-3 py-1 rounded-full font-medium capitalize inline-block", STATUS_COLORS[c.status ?? "active"] ?? "bg-surface border border-hairline text-ink-60")}>
                      {(c.status ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[14px] text-ink-60 capitalize hidden md:table-cell">{c.riskProfile ?? "—"}</td>
                  <td className="px-5 py-3 text-[15px] text-forest font-semibold text-right tabular-nums hidden md:table-cell">{c.portfolioValue > 0 ? fmtUSD(c.portfolioValue) : "—"}</td>
                  <td className="px-5 py-3 text-[14px] text-ink-60 text-right tabular-nums hidden lg:table-cell">{c.plansCount}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/advisor/clients/${c.id}`} className="text-[14px] font-medium text-green hover:text-forest flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
