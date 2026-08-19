import { db, profilesTable, clientProfilesTable } from "@workspace/db";

export interface CreateUserInput {
  email: string;
  password: string;
  fullName?: string | null;
  role: string;
  advisorId?: string | null;
  riskProfile?: string | null;
  status?: string | null;
}

export type CreateUserResult =
  | { ok: true; profile: typeof profilesTable.$inferSelect }
  | { ok: false; httpStatus: number; error: string };

/**
 * Creates a Clerk user plus the matching profiles row (and, for
 * investment_client, a client_profiles row). Shared by admin's user-creation
 * flow and the advisor lead-conversion flow — keep both call sites using this
 * so they can't drift apart.
 */
export async function createUserWithProfile(input: CreateUserInput): Promise<CreateUserResult> {
  const { email, password, fullName, role, advisorId, riskProfile, status } = input;
  if (!email || !password) return { ok: false, httpStatus: 400, error: "email and password required" };

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) return { ok: false, httpStatus: 500, error: "CLERK_SECRET_KEY not configured" };

  const nameParts = (fullName ?? "").trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const clerkRes = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: firstName,
      last_name: lastName,
      skip_password_checks: true,
      skip_password_requirement: false,
    }),
  });

  if (!clerkRes.ok) {
    const errBody = await clerkRes.json().catch(() => ({}));
    const msg = (errBody as any).errors?.[0]?.long_message ?? (errBody as any).errors?.[0]?.message ?? "Failed to create user in Clerk";
    return { ok: false, httpStatus: 400, error: msg };
  }

  const clerkUser = await clerkRes.json() as { id: string };

  const [profile] = await db.insert(profilesTable).values({
    id: clerkUser.id,
    email,
    fullName: fullName || null,
    role: role || "free_user",
  }).returning();

  if (role === "investment_client") {
    await db.insert(clientProfilesTable).values({
      userId: clerkUser.id,
      advisorId: advisorId || null,
      riskProfile: riskProfile || null,
      status: status || "prospect",
    });
  }

  return { ok: true, profile };
}
