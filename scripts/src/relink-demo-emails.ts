import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY not set");

// This Clerk instance's only sign-in first factor is an emailed one-time code
// (no password first factor) — see /v1/environment user_settings.attributes.email_address.
// The demo accounts' fake @demo.wealthapp.io addresses can never receive that code, so
// re-point each one to a Gmail "+alias" of the real account owner's inbox, which Gmail
// delivers to the same mailbox while Clerk still treats each as a distinct address.
const REMAP: Array<{ oldEmail: string; newEmail: string }> = [
  { oldEmail: "sofia.chen@demo.wealthapp.io", newEmail: "trinh.thu.mktg+sofia@gmail.com" },
  { oldEmail: "marcus.reyes@demo.wealthapp.io", newEmail: "trinh.thu.mktg+marcus@gmail.com" },
  { oldEmail: "elena.novak@demo.wealthapp.io", newEmail: "trinh.thu.mktg+elena@gmail.com" },
  { oldEmail: "james.whitfield@demo.wealthapp.io", newEmail: "trinh.thu.mktg+james@gmail.com" },
];

async function clerkFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(`Clerk ${init?.method ?? "GET"} ${path} failed: ${JSON.stringify(body.errors ?? body)}`);
  return body;
}

async function run() {
  console.log("\n📧 Re-pointing demo account emails to a real, checkable inbox\n");

  for (const { oldEmail, newEmail } of REMAP) {
    const list = await clerkFetch(`/users?email_address=${encodeURIComponent(oldEmail)}&limit=1`);
    const user = Array.isArray(list) ? list.find((u: any) => u.email_addresses?.some((e: any) => e.email_address === oldEmail)) : null;
    if (!user) { console.log(`✗ ${oldEmail} — no Clerk user found, skipping`); continue; }

    const oldEmailId = user.email_addresses.find((e: any) => e.email_address === oldEmail)?.id;

    const newAddr = await clerkFetch(`/email_addresses`, {
      method: "POST",
      body: JSON.stringify({ user_id: user.id, email_address: newEmail, verified: true, primary: true }),
    });

    await clerkFetch(`/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ primary_email_address_id: newAddr.id }),
    });

    if (oldEmailId) {
      await clerkFetch(`/email_addresses/${oldEmailId}`, { method: "DELETE" });
    }

    await db.update(profilesTable).set({ email: newEmail, updatedAt: new Date() }).where(eq(profilesTable.id, user.id));

    console.log(`✓ ${oldEmail}  →  ${newEmail}`);
  }

  console.log("\nDone. Sign in with the new email addresses — Clerk will email the one-time code to your Gmail inbox.\n");
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
