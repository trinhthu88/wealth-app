import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

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
