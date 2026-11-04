import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { getEntitlementContext } from "../lib/entitlements";

const router: IRouter = Router();

router.get("/me/entitlements", requireAuth, async (req, res): Promise<void> => {
  const { entitlements } = await getEntitlementContext(req);
  res.json(entitlements);
});

export default router;
