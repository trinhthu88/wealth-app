import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

function paramAsString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { db, profilesTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    if (!profile || !roles.includes(profile.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    (req as any).userRole = profile.role;
    next();
  };
}

/**
 * Must run after requireAuth + requireRole("advisor", "super_admin"). Verifies the
 * caller is either super_admin, or the advisor assigned to the client identified by
 * req.params[paramName] (via client_profiles.advisor_id).
 */
export function requireAdvisorOwnsClient(paramName: string = "id") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    if (userRole === "super_admin") {
      next();
      return;
    }
    const clientId = paramAsString(req.params[paramName]);
    if (!clientId) {
      res.status(400).json({ error: `Missing ${paramName} param` });
      return;
    }
    const { db, clientProfilesTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [cp] = await db
      .select({ advisorId: clientProfilesTable.advisorId })
      .from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, clientId));
    if (!cp || cp.advisorId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * Must run after requireAuth. For routes keyed by a client_packages.id (req.params[paramName]).
 * Grants access to: the client who owns the package, the advisor assigned to that client, or
 * super_admin. Use for read routes that clients and advisors both need.
 */
export function requirePackageReadAccess(paramName: string = "id") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const packageId = paramAsString(req.params[paramName]);
    if (!packageId) {
      res.status(400).json({ error: `Missing ${paramName} param` });
      return;
    }
    const { db, clientPackagesTable, clientProfilesTable, profilesTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [pkg] = await db
      .select({ userId: clientPackagesTable.userId })
      .from(clientPackagesTable)
      .where(eq(clientPackagesTable.id, packageId));
    if (!pkg) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (pkg.userId === userId) {
      next();
      return;
    }
    const [caller] = await db.select({ role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.id, userId));
    if (caller?.role === "super_admin") {
      next();
      return;
    }
    const [cp] = await db
      .select({ advisorId: clientProfilesTable.advisorId })
      .from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, pkg.userId));
    if (cp?.advisorId === userId) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}

/**
 * Must run after requireAuth + requireRole("advisor", "super_admin"). For write routes keyed by
 * a client_packages.id (req.params[paramName]). Only the advisor assigned to the owning client,
 * or super_admin, may proceed.
 */
export function requireAdvisorOwnsPackage(paramName: string = "id") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId;
    const userRole = (req as any).userRole;
    const packageId = paramAsString(req.params[paramName]);
    if (!packageId) {
      res.status(400).json({ error: `Missing ${paramName} param` });
      return;
    }
    const { db, clientPackagesTable, clientProfilesTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [pkg] = await db
      .select({ userId: clientPackagesTable.userId })
      .from(clientPackagesTable)
      .where(eq(clientPackagesTable.id, packageId));
    if (!pkg) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (userRole === "super_admin") {
      next();
      return;
    }
    const [cp] = await db
      .select({ advisorId: clientProfilesTable.advisorId })
      .from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, pkg.userId));
    if (!cp || cp.advisorId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
