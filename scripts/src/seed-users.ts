import pg from "pg";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY not set");
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const USERS = [
  { email: "contact@erickson.vn",      role: "free_user",         fullName: "Free User" },
  { email: "trang.tt@erickson.vn",     role: "investment_client", fullName: "Trang (Client)" },
  { email: "trang.tt@hsp.consulting",  role: "advisor",           fullName: "Trang (Advisor)" },
];

const DEFAULT_PASSWORD = "Wealth@2024";

async function createClerkUser(email: string, fullName: string): Promise<string | null> {
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ") || undefined;

  const res = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password: DEFAULT_PASSWORD,
      first_name: firstName,
      last_name: lastName,
      skip_password_checks: true,
    }),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    if (data.errors?.[0]?.code === "form_identifier_exists") {
      console.log(`  → already exists in Clerk, fetching ID…`);
      const search = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`, {
        headers: { "Authorization": `Bearer ${CLERK_SECRET_KEY}` },
      });
      const list = await search.json() as any;
      const found = Array.isArray(list) ? list.find((u: any) =>
        u.email_addresses?.some((e: any) => e.email_address === email)
      ) : null;
      return found?.id ?? null;
    }
    console.error(`  ✗ Clerk error:`, JSON.stringify(data.errors ?? data));
    return null;
  }

  return data.id as string;
}

async function run() {
  console.log(`\nSeeding ${USERS.length} users (default password: ${DEFAULT_PASSWORD})\n`);

  for (const user of USERS) {
    console.log(`→ ${user.email} [${user.role}]`);

    const clerkId = await createClerkUser(user.email, user.fullName);
    if (!clerkId) {
      console.log(`  ✗ Skipped — could not get Clerk ID\n`);
      continue;
    }
    console.log(`  ✓ Clerk ID: ${clerkId}`);

    await pool.query(
      `INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (id) DO UPDATE SET role = $4, email = $2, full_name = $3, updated_at = now()`,
      [clerkId, user.email, user.fullName, user.role]
    );
    console.log(`  ✓ DB profile upserted with role: ${user.role}\n`);
  }

  await pool.end();
  console.log("✅ All done!");
}

run().catch((err) => { console.error(err); process.exit(1); });
