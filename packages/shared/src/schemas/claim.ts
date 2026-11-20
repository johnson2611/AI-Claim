import { z } from "zod";

export const ROLES = ["CUSTOMER", "OFFICER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const CLAIM_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFO_REQUIRED",
  "REVIEWED",
] as const;
export const ClaimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const INCIDENT_TYPES = ["COLLISION", "THEFT", "VANDALISM", "WEATHER", "OTHER"] as const;
export const CONTACT_CHANNELS = ["EMAIL", "PHONE", "SMS"] as const;
export const EVIDENCE_LABELS = ["FRONT", "REAR", "SIDE", "DAMAGE", "SCENE", "OTHER"] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_EVIDENCE_PER_CLAIM = 12;

export const CONSENT_PURPOSES = ["DATA_PROCESSING", "CLOUD_AI_PROCESSING", "IMAGE_ANALYSIS"] as const;
export const CURRENT_CONSENT_VERSION = "2026-11-v1";

/** Every field is optional while the claim is a draft. */
export const claimFieldsSchema = z.object({
  policyReferenceMasked: z.string().trim().min(4).max(40),
  incidentAt: z.coerce.date(),
  incidentLocation: z.string().trim().min(3).max(300),
  incidentType: z.enum(INCIDENT_TYPES),
  narrative: z.string().trim().max(4000),
  vehicleDescription: z.string().trim().max(200),
  injuriesReported: z.boolean(),
  otherPartiesInvolved: z.boolean(),
  contactChannel: z.enum(CONTACT_CHANNELS),
});
export const draftClaimSchema = claimFieldsSchema.partial();
export type DraftClaimInput = z.infer<typeof draftClaimSchema>;

export const evidenceRegisterSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
  label: z.enum(EVIDENCE_LABELS),
  checksum: z.string().regex(/^[a-f0-9]{64}$/, "Expected a SHA-256 hex digest"),
});
export type EvidenceRegisterInput = z.infer<typeof evidenceRegisterSchema>;

export const consentSchema = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  consentVersion: z.string().min(1).max(40).default(CURRENT_CONSENT_VERSION),
});

export const REVIEW_ACTIONS = ["START_REVIEW", "REQUEST_MORE_INFO", "MARK_REVIEWED"] as const;
export const reviewSchema = z
  .object({
    action: z.enum(REVIEW_ACTIONS),
    officerSummary: z.string().trim().max(4000).optional(),
    message: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.action !== "REQUEST_MORE_INFO" || (v.message && v.message.length > 0), {
    message: "A message to the customer is required when requesting more information",
    path: ["message"],
  });
export type ReviewInput = z.infer<typeof reviewSchema>;
