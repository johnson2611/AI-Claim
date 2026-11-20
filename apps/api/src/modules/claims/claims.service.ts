import { randomBytes } from "node:crypto";
import { Prisma, type ClaimCase, type ClaimStatus } from "@prisma/client";
import {
  assessCompleteness,
  canTransition,
  CUSTOMER_EDITABLE_STATUSES,
  type AiSummary,
  type DraftClaimInput,
} from "@claims/shared";
import { prisma } from "../../db/client";
import { HttpError } from "../../middleware/errors";
import type { AuthUser } from "../../types";
import { recordEvent } from "../audit/audit.service";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

function newReference(): string {
  const suffix = Array.from(randomBytes(6), (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
  return `CLM-${new Date().getUTCFullYear()}-${suffix}`;
}

export async function createDraft(user: AuthUser, data: DraftClaimInput) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const claim = await tx.claimCase.create({
          data: { ...data, customerId: user.id, publicReference: newReference() },
        });
        await recordEvent(tx, {
          claimId: claim.id,
          actorId: user.id,
          eventType: "CLAIM_CREATED",
          toStatus: "DRAFT",
        });
        return claim;
      });
    } catch (e) {
      const collision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!collision) throw e;
    }
  }
  throw new HttpError(500, "Could not generate a claim reference. Please try again.");
}

/** Customers see only their own claims. Officers see submitted claims, never other people's drafts. */
export async function getAuthorisedClaim(id: string, user: AuthUser) {
  const claim = await prisma.claimCase.findUnique({ where: { id } });
  if (!claim) throw new HttpError(404, "Claim not found.");
  if (user.role === "CUSTOMER") {
    if (claim.customerId !== user.id) throw new HttpError(403, "You cannot access this claim.");
  } else if (claim.status === "DRAFT") {
    throw new HttpError(403, "Draft claims are not visible to claims officers.");
  }
  return claim;
}

export async function getOwnedEditableClaim(id: string, user: AuthUser) {
  const claim = await getAuthorisedClaim(id, user);
  if (user.role !== "CUSTOMER") throw new HttpError(403, "Only the customer can change this report.");
  if (!CUSTOMER_EDITABLE_STATUSES.includes(claim.status)) {
    throw new HttpError(409, "This report can no longer be edited.");
  }
  return claim;
}

export function listOwn(user: AuthUser) {
  return prisma.claimCase.findMany({
    where: { customerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, publicReference: true, status: true, incidentType: true, updatedAt: true },
  });
}

export async function updateDraft(id: string, user: AuthUser, data: DraftClaimInput) {
  await getOwnedEditableClaim(id, user);
  return prisma.$transaction(async (tx) => {
    const claim = await tx.claimCase.update({ where: { id }, data });
    await recordEvent(tx, {
      claimId: id,
      actorId: user.id,
      eventType: "FIELDS_UPDATED",
      metadata: { fields: Object.keys(data) },
    });
    return claim;
  });
}

export async function saveAiDraft(id: string, user: AuthUser, draft: AiSummary) {
  await getOwnedEditableClaim(id, user);
  return prisma.claimCase.update({ where: { id }, data: { aiDraft: draft } });
}

export async function submitClaim(id: string, user: AuthUser) {
  const claim = await getOwnedEditableClaim(id, user).catch((e) => {
    // Idempotent: re-submitting an already submitted claim returns it unchanged.
    if (e instanceof HttpError && e.status === 409) return getAuthorisedClaim(id, user);
    throw e;
  });
  if (claim.status === "SUBMITTED") return claim;

  const [evidence, consent] = await Promise.all([
    prisma.evidence.findMany({ where: { claimId: id, uploadedAt: { not: null } }, select: { label: true } }),
    prisma.consentRecord.findFirst({
      where: { claimId: id, purpose: "DATA_PROCESSING", withdrawnAt: null },
    }),
  ]);

  const check = assessCompleteness(claim, evidence.map((e) => e.label));
  if (!check.readyToSubmit || !consent) {
    throw new HttpError(422, "The report is not ready to submit.", {
      missingFields: check.missingFields,
      missingEvidence: check.missingEvidence,
      consentRequired: !consent,
    });
  }
  return transition(claim, "SUBMITTED", user, { eventType: "CLAIM_SUBMITTED", set: { submittedAt: new Date() } });
}

export async function transition(
  claim: ClaimCase,
  to: ClaimStatus,
  user: AuthUser,
  opts: { eventType: string; metadata?: Prisma.InputJsonValue; set?: Prisma.ClaimCaseUpdateInput },
) {
  if (!canTransition(claim.status, to, user.role)) {
    throw new HttpError(409, `A claim cannot move from ${claim.status} to ${to}.`);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.claimCase.update({ where: { id: claim.id }, data: { ...opts.set, status: to } });
    await recordEvent(tx, {
      claimId: claim.id,
      actorId: user.id,
      eventType: opts.eventType,
      fromStatus: claim.status,
      toStatus: to,
      metadata: opts.metadata,
    });
    return updated;
  });
}

export async function recordConsent(id: string, user: AuthUser, purpose: string, consentVersion: string) {
  await getOwnedEditableClaim(id, user);
  return prisma.$transaction(async (tx) => {
    const record = await tx.consentRecord.create({
      data: { claimId: id, userId: user.id, purpose, consentVersion },
    });
    await recordEvent(tx, {
      claimId: id,
      actorId: user.id,
      eventType: "CONSENT_GRANTED",
      metadata: { purpose, consentVersion },
    });
    return record;
  });
}

export async function listEvents(id: string, user: AuthUser) {
  await getAuthorisedClaim(id, user);
  return prisma.claimEvent.findMany({
    where: { claimId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, eventType: true, fromStatus: true, toStatus: true, metadata: true, createdAt: true, actorId: true },
  });
}

export async function claimDetail(id: string, user: AuthUser) {
  const claim = await getAuthorisedClaim(id, user);
  const [evidence, analyses, consents] = await Promise.all([
    prisma.evidence.findMany({
      where: { claimId: id, uploadedAt: { not: null } },
      select: { id: true, fileName: true, fileType: true, fileSize: true, label: true, uploadedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.aiAnalysis.findMany({ where: { claimId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.consentRecord.findMany({ where: { claimId: id }, select: { purpose: true, grantedAt: true, withdrawnAt: true } }),
  ]);
  const completeness = assessCompleteness(claim, evidence.map((e) => e.label));
  return { ...claim, evidence, analyses, consents, completeness };
}
