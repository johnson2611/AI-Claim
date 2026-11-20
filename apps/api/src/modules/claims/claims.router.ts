import { Router } from "express";
import { aiSummarySchema, aiTelemetrySchema, consentSchema, draftClaimSchema } from "@claims/shared";
import { prisma } from "../../db/client";
import { currentUser } from "../../middleware/auth";
import { aiTelemetryLimiter, writeLimiter } from "../../middleware/rateLimit";
import * as claims from "./claims.service";
import { param } from "../../utils/params";
import { evidenceRouter } from "../evidence/evidence.router";

export const claimsRouter = Router();

claimsRouter.get("/", async (req, res) => {
  res.json(await claims.listOwn(currentUser(req)));
});

claimsRouter.post("/", writeLimiter, async (req, res) => {
  const data = draftClaimSchema.parse(req.body);
  res.status(201).json(await claims.createDraft(currentUser(req), data));
});

claimsRouter.get("/:id", async (req, res) => {
  res.json(await claims.claimDetail(param(req, "id"), currentUser(req)));
});

claimsRouter.patch("/:id", writeLimiter, async (req, res) => {
  const data = draftClaimSchema.parse(req.body);
  res.json(await claims.updateDraft(param(req, "id"), currentUser(req), data));
});

claimsRouter.put("/:id/ai-draft", writeLimiter, async (req, res) => {
  const draft = aiSummarySchema.parse(req.body);
  await claims.saveAiDraft(param(req, "id"), currentUser(req), draft);
  res.status(204).end();
});

claimsRouter.post("/:id/consents", writeLimiter, async (req, res) => {
  const { purpose, consentVersion } = consentSchema.parse(req.body);
  res.status(201).json(await claims.recordConsent(param(req, "id"), currentUser(req), purpose, consentVersion));
});

/** Records WHICH route ran (on-device/cloud) and why: never the prompt or the output. */
claimsRouter.post("/:id/ai-analyses", aiTelemetryLimiter, async (req, res) => {
  const user = currentUser(req);
  const t = aiTelemetrySchema.parse(req.body);
  await claims.getOwnedEditableClaim(param(req, "id"), user);
  const record = await prisma.aiAnalysis.create({
    data: {
      claimId: param(req, "id"),
      taskType: t.task,
      route: t.route,
      fallbackReason: t.fallbackReason,
      modelId: t.modelId,
      promptVersion: t.promptVersion,
      outputSchemaVersion: t.outputSchemaVersion,
      status: t.status,
      latencyMs: t.latencyMs,
    },
  });
  res.status(201).json({ id: record.id });
});

claimsRouter.post("/:id/submit", writeLimiter, async (req, res) => {
  res.json(await claims.submitClaim(param(req, "id"), currentUser(req)));
});

claimsRouter.get("/:id/events", async (req, res) => {
  res.json(await claims.listEvents(param(req, "id"), currentUser(req)));
});

claimsRouter.use("/:id/evidence", evidenceRouter);
