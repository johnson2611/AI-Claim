import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { assessCompleteness, ClaimStatusSchema, reviewSchema } from "@claims/shared";
import { prisma } from "../../db/client";
import { currentUser } from "../../middleware/auth";
import { HttpError } from "../../middleware/errors";
import { writeLimiter } from "../../middleware/rateLimit";
import { getAuthorisedClaim, transition } from "../claims/claims.service";
import { param } from "../../utils/params";
import { recordEvent } from "../audit/audit.service";

export const officerRouter = Router();

/** Queue of submitted claims, oldest first, with a completeness indicator. */
officerRouter.get("/claims", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 25) || 25, 100);
  const statusParam = ClaimStatusSchema.safeParse(req.query.status);
  const where: Prisma.ClaimCaseWhereInput = statusParam.success
    ? { status: statusParam.data === "DRAFT" ? "SUBMITTED" : statusParam.data }
    : { status: { not: "DRAFT" } };
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  const rows = await prisma.claimCase.findMany({
    where,
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { evidence: { where: { uploadedAt: { not: null } }, select: { label: true } } },
  });
  const page = rows.slice(0, limit);
  res.json({
    items: page.map((c) => ({
      id: c.id,
      publicReference: c.publicReference,
      status: c.status,
      incidentType: c.incidentType,
      submittedAt: c.submittedAt,
      completenessPercent: assessCompleteness(c, c.evidence.map((e) => e.label)).percent,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1]?.id : null,
  });
});

officerRouter.post("/claims/:id/review", writeLimiter, async (req, res) => {
  const officer = currentUser(req);
  const input = reviewSchema.parse(req.body);
  const claim = await getAuthorisedClaim(param(req, "id"), officer);

  switch (input.action) {
    case "START_REVIEW": {
      res.json(await transition(claim, "UNDER_REVIEW", officer, { eventType: "REVIEW_STARTED" }));
      return;
    }
    case "REQUEST_MORE_INFO": {
      const updated = await transition(claim, "MORE_INFO_REQUIRED", officer, {
        eventType: "MORE_INFO_REQUESTED",
        // Officer-authored message: stored in the event so the customer can read it.
        metadata: { message: input.message ?? "" },
        set: input.officerSummary !== undefined ? { officerSummary: input.officerSummary } : undefined,
      });
      res.json(updated);
      return;
    }
    case "MARK_REVIEWED": {
      if (!input.officerSummary) throw new HttpError(422, "Add your reviewed summary before marking as reviewed.");
      const updated = await transition(claim, "REVIEWED", officer, {
        eventType: "CLAIM_REVIEWED",
        set: { officerSummary: input.officerSummary },
      });
      await recordEvent(prisma, {
        claimId: claim.id,
        actorId: officer.id,
        eventType: "AI_DRAFT_REVIEWED",
        metadata: { aiDraftPresent: claim.aiDraft !== null },
      });
      res.json(updated);
      return;
    }
  }
});
