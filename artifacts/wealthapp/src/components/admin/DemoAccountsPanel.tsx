import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

interface DemoAccountStatus {
  key: string;
  label: string;
  role: string;
  email: string;
  exists: boolean;
}

interface DemoAccountLogin {
  key: string;
  label: string;
  fullName: string;
  email: string;
  password: string | null;
  passwordNote: "own_login" | "email_code" | null;
  created: boolean;
  seeded: boolean;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Couldn't copy. Select the text and copy it instead.");
  }
}

/**
 * Creates the four demo logins (free, Track B, Track A, advisor) on this deployment and shows
 * their passwords once. Renders nothing unless the server has demo accounts turned on.
 */
export default function DemoAccountsPanel() {
  const [logins, setLogins] = useState<DemoAccountLogin[] | null>(null);

  const { data } = useQuery<{ enabled: boolean; accounts: DemoAccountStatus[]; configError?: string }>({
    queryKey: ["admin-demo-accounts"],
    queryFn: () => apiFetch("/admin/demo-accounts"),
  });

  const run = useMutation({
    mutationFn: () => apiFetch<{ accounts: DemoAccountLogin[] }>("/admin/demo-accounts", { method: "POST" }),
    onSuccess: (res) => {
      setLogins(res.accounts);
      queryClient.invalidateQueries({ queryKey: ["admin-demo-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Demo accounts are ready");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't create the demo accounts"),
  });

  if (data?.configError) {
    return (
      <section className="bg-surface rounded-[24px] p-5 mb-6 border border-hairline" role="alert">
        <h2 className="font-display text-[18px] font-semibold text-forest">Demo accounts are not set up correctly</h2>
        <p className="text-[14px] text-ink-40 mt-1 max-w-prose">{data.configError} Fix the deployment setting and redeploy.</p>
      </section>
    );
  }
  if (!data?.enabled) return null;
  const allExist = data.accounts.every((a) => a.exists);

  return (
    <section className="bg-surface rounded-[24px] p-5 mb-6 border border-hairline" aria-labelledby="demo-accounts-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="demo-accounts-title" className="font-display text-[18px] font-semibold text-forest flex items-center gap-2">
            <Users className="h-5 w-5" /> Demo accounts
          </h2>
          <p className="text-[14px] text-ink-40 mt-1 max-w-prose">
            {allExist
              ? `The ${data.accounts.length} demo logins exist. Generating new passwords keeps their data and replaces the old passwords.`
              : `Sets up ${data.accounts.length} demo logins with sample data for showing the app to colleagues. Accounts that already have data keep it.`}
          </p>
        </div>
        <Button className="rounded-full px-5 bg-forest text-paper hover:bg-forest-700" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Working…" : allExist ? "Generate new passwords" : "Create demo accounts"}
        </Button>
      </div>

      {logins && (
        <div className="mt-5 overflow-x-auto">
          <p className="text-[13px] text-clay font-semibold mb-2">
            Copy these now. The passwords are not shown again; generate new ones if you lose them.
          </p>
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-ink-40">
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 font-medium">Password</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.key} className="border-t border-hairline">
                  <td className="py-2 pr-4 text-forest">
                    <div className="font-semibold">{l.label}</div>
                    <div className="text-ink-40 text-[13px]">
                      {l.fullName}
                      {l.seeded ? " · sample data added" : l.created ? "" : " · existing data kept"}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <button className="inline-flex items-center gap-1 text-forest hover:underline" onClick={() => copy(l.email)}>
                      <span className="select-all break-all">{l.email}</span> <Copy className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </td>
                  <td className="py-2">
                    {l.password ? (
                      <button className="inline-flex items-center gap-1 font-mono text-forest hover:underline" onClick={() => copy(l.password!)}>
                        <span className="select-all">{l.password}</span> <Copy className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    ) : l.passwordNote === "own_login" ? (
                      <span className="text-ink-40">Your own login, password unchanged</span>
                    ) : (
                      <span className="text-ink-40">Signs in with an email code sent to this address</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
