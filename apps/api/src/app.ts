import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { currentUser, requireAuth, requireRole, verifyAppCheck } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/errors";
import { globalLimiter } from "./middleware/rateLimit";
import { claimsRouter } from "./modules/claims/claims.router";
import { officerRouter } from "./modules/reviews/reviews.router";
import "./types";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()), credentials: false }));
  app.use(express.json({ limit: "100kb" })); // claim text only: image bytes never pass through the API
  app.use(globalLimiter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", verifyAppCheck, requireAuth);
  // Raw image bytes are accepted only on the upload route, and only after authentication.
  app.use("/api/claims/:id/evidence/:evidenceId/content", express.raw({ type: ["image/jpeg", "image/png"], limit: "8mb" }));
  app.get("/api/me", (req, res) => res.json(currentUser(req)));
  app.use("/api/claims", claimsRouter);
  app.use("/api/officer", requireRole("OFFICER", "ADMIN"), officerRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
