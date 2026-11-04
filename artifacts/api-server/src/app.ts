import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// One proxy sits in front of the app, so req.ip is the visitor's address, not the proxy's. Without
// this the per-IP limit on POST /leads would put every visitor in one bucket. Trusting more
// hops than exist would let a caller choose their own IP with X-Forwarded-For.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// Stripe webhook signature verification needs the raw request body, so this
// must be registered — at the route's full mounted paths — before the global
// express.json() below, or express.json() will have already parsed (and thus
// mangled) the body by the time it reaches the route.
app.use(["/api/webhooks/stripe", "/api/billing/webhook"], express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
