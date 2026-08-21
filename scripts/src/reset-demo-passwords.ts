import crypto from "node:crypto";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY not set");

const DEMO_EMAILS = [
  "sofia.chen@demo.wealthapp.io",
  "marcus.reyes@demo.wealthapp.io",
  "elena.novak@demo.wealthapp.io",
  "james.whitfield@demo.wealthapp.io",
];

// Distinct per-account passwords — Clerk's compromised-password check flags a
// password shared across multiple accounts, which is why the seed scripts'
// single shared password ("Wealth@2024") was forcing a reset prompt at sign-in.
function generatePassword(): string {
  const words = ["Maple", "Harbor", "Cobalt", "Ridge", "Falcon", "Willow", "Ember", "Granite"];
  const word = words[crypto.randomInt(words.length)];
  const digits = crypto.randomInt(1000, 9999);
  return `${word}${digits}!wx`;
}

async function findClerkUserId(email: string): Promise<string> {
  const res = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  const list = (await res.json()) as any;
  const found = Array.isArray(list) ? list.find((u: any) => u.email_addresses?.some((e: any) => e.email_address === email)) : null;
  if (!found?.id) throw new Error(`No Clerk user found for ${email}`);
  return found.id as string;
}

async function setPassword(userId: string, password: string): Promise<void> {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password, skip_password_checks: true }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Failed to update password: ${JSON.stringify((body as any).errors ?? body)}`);
  }
}

async function run() {
  console.log("\n🔑 Assigning unique passwords to demo accounts (fixes Clerk's forced reset prompt)\n");
  const results: Array<{ email: string; password: string }> = [];

  for (const email of DEMO_EMAILS) {
    const userId = await findClerkUserId(email);
    const password = generatePassword();
    await setPassword(userId, password);
    results.push({ email, password });
    console.log(`✓ ${email}`);
  }

  console.log("\nNew credentials:\n");
  for (const r of results) console.log(`  ${r.email.padEnd(36)} ${r.password}`);
  console.log("");
}

run().catch((err) => { console.error(err); process.exit(1); });
