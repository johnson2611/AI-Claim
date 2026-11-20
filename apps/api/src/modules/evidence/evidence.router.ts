import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { evidenceRegisterSchema, MAX_EVIDENCE_PER_CLAIM } from "@claims/shared";
import { prisma } from "../../db/client";
import { currentUser } from "../../middleware/auth";
import { HttpError } from "../../middleware/errors";
import { uploadLimiter } from "../../middleware/rateLimit";
import { openObject, removeObject, saveObject, statObject } from "../../storage/local";
import { param } from "../../utils/params";
import { recordEvent } from "../audit/audit.service";
import { getAuthorisedClaim, getOwnedEditableClaim } from "../claims/claims.service";

export const evidenceRouter = Router({ mergeParams: true });

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };
const MAGIC: Record<string, number[]> = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47] };

/** Step 1: register what the browser intends to upload. Nothing counts as evidence yet. */
evidenceRouter.post("/", uploadLimiter, async (req, res) => {
  const user = currentUser(req);
  const claimId = param(req, "id");
  const input = evidenceRegisterSchema.parse(req.body);
  await getOwnedEditableClaim(claimId, user);

  const count = await prisma.evidence.count({ where: { claimId } });
  if (count >= MAX_EVIDENCE_PER_CLAIM) {
    throw new HttpError(422, `You can attach up to ${MAX_EVIDENCE_PER_CLAIM} images to one report.`);
  }

  const evidence = await prisma.evidence.create({
    data: {
      claimId,
      storageObjectKey: `claims/${claimId}/${randomUUID()}.${EXT[input.contentType]}`,
      fileName: input.fileName,
      fileType: input.contentType,
      fileSize: input.sizeBytes,
      label: input.label,
      checksum: input.checksum,
    },
  });
  res.status(201).json({
    evidenceId: evidence.id,
    uploadPath: `/api/claims/${claimId}/evidence/${evidence.id}/content`,
  });
});

/** Step 2: receive the image bytes, verify them against what was declared, then store them. */
evidenceRouter.put("/:evidenceId/content", uploadLimiter, async (req, res) => {
  const user = currentUser(req);
  const claimId = param(req, "id");
  await getOwnedEditableClaim(claimId, user);
  const evidence = await prisma.evidence.findFirst({ where: { id: param(req, "evidenceId"), claimId } });
  if (!evidence) throw new HttpError(404, "Evidence not found.");
  if (evidence.uploadedAt) throw new HttpError(409, "This photo was already uploaded.");

  const body: unknown = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new HttpError(400, "Send the image as the request body, with its image content type.");
  }

  const reject = async (message: string): Promise<never> => {
    await prisma.evidence.delete({ where: { id: evidence.id } });
    throw new HttpError(422, message);
  };

  if (!(req.headers["content-type"] ?? "").startsWith(evidence.fileType)) {
    await reject("The file type did not match what was declared.");
  }
  if (body.length !== evidence.fileSize) await reject("The uploaded file did not match what was declared.");
  const expected = MAGIC[evidence.fileType] ?? [];
  if (!expected.every((byte, i) => body[i] === byte)) await reject("That file is not a valid JPEG or PNG image.");
  if (createHash("sha256").update(body).digest("hex") !== evidence.checksum) {
    await reject("The file changed during upload. Please try again.");
  }

  await saveObject(evidence.storageObjectKey, body);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.evidence.update({
        where: { id: evidence.id },
        // TODO: set CLEAN/INFECTED once a malware scanner is wired in.
        data: { uploadedAt: new Date(), scanStatus: "SKIPPED" },
      });
      await recordEvent(tx, {
        claimId,
        actorId: user.id,
        eventType: "EVIDENCE_ADDED",
        metadata: { label: evidence.label, fileType: evidence.fileType },
      });
    });
  } catch (e) {
    await removeObject(evidence.storageObjectKey);
    throw e;
  }
  res.json({ evidenceId: evidence.id });
});

/** Authenticated download for the owner or a reviewing officer. Photos are never publicly addressable. */
evidenceRouter.get("/:evidenceId/content", async (req, res) => {
  const user = currentUser(req);
  const claimId = param(req, "id");
  await getAuthorisedClaim(claimId, user);
  const evidence = await prisma.evidence.findFirst({
    where: { id: param(req, "evidenceId"), claimId, uploadedAt: { not: null } },
  });
  if (!evidence) throw new HttpError(404, "Evidence not found.");
  const info = await statObject(evidence.storageObjectKey);
  if (!info) throw new HttpError(404, "Evidence file is missing.");

  res.setHeader("Content-Type", evidence.fileType);
  res.setHeader("Content-Length", String(info.size));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  const stream = openObject(evidence.storageObjectKey);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
});
