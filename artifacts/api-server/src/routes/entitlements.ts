import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { getEntitlementContext } from "../lib/entitlements";
import { dailyCheckin, getEngagement } from "../lib/engagement";

const router: IRouter = Router();

router.get("/me/entitlements", requireAuth, async (req, res): Promise<void> => {
  // First, because the check-in can fire a checkpoint that this response should carry.
  await dailyCheckin((req as any).userId);
  const { entitlements } = await getEntitlementContext(req);
  res.json(entitlements);
});

router.get("/me/engagement", requireAuth, async (req, res): Promise<void> => {
  res.json(await getEngagement((req as any).userId));
});

export default router;
