import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Client { id: string; fullName: string | null; email: string; role: string; kycStatus: string | null; riskProfile: string | null; onboardingStep: number | null; createdAt: string; }

const KYC_COLORS: Record<string, string> = {
  not_submitted: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdvisorClients() {
  const [search, setSearch] = useState("");
  const { data: clients = [], isLoading } = useQuery<Client[]>({ queryKey: ["advisor-clients"], queryFn: () => apiFetch<Client[]>("/advisor/clients") });

  const filtered = clients.filter(c =>
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.fullName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader title="My Clients" subtitle={`${clients.length} clients under management`} />

      <div className="mb-4">
        <Input placeholder="Search clients by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-16 text-center">
          <Users className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">{search ? "No matching clients" : "No clients yet"}</h3>
          <p className="text-muted-foreground text-sm">{search ? "Try a different search term." : "Clients assigned to you will appear here."}</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">KYC Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk Profile</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {(c.fullName ?? c.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{c.fullName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", KYC_COLORS[c.kycStatus ?? "not_submitted"] ?? "bg-muted text-muted-foreground")}>
                      {(c.kycStatus ?? "not submitted").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{c.riskProfile ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link href={`/advisor/clients/${c.id}`}>
                      <a className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium">
                        View <ArrowRight className="h-3.5 w-3.5" />
                      </a>
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
