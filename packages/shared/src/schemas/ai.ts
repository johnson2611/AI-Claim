import { z } from "zod";

export const AI_ROUTES = ["ON_DEVICE", "IN_CLOUD"] as const;
export type AiRoute = (typeof AI_ROUTES)[number];

export const AI_TASKS = ["NARRATIVE_REWRITE", "MISSING_FIELDS", "CASE_SUMMARY", "IMAGE_CHECK"] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const AI_FALLBACK_REASONS = [
  "ON_DEVICE_UNAVAILABLE",
  "ON_DEVICE_ERROR",
  "TASK_REQUIRES_CLOUD",
  "POLICY_CLOUD_ONLY",
] as const;
export type AiFallbackReason = (typeof AI_FALLBACK_REASONS)[number];

export const SAFETY_NOTICE = "AI-assisted draft. Human review required." as const;
export const OUTPUT_SCHEMA_VERSION = "case-summary-v1";

export const PHOTO_QUALITIES = ["clear", "blurry", "dark", "partial", "unclear"] as const;
export const PHOTO_OBSERVATION_SCHEMA_VERSION = "photo-observation-v1";

/** What the model returns for ONE photo. Evidence id and label are added by our code, not the model. */
export const photoModelOutputSchema = z.object({
  visible_description: z.string().min(1).max(500),
  photo_quality: z.enum(PHOTO_QUALITIES),
  matches_label: z.enum(["yes", "no", "unclear"]),
  uncertainties: z.array(z.string().max(200)).max(5).default([]),
});

export const photoObservationSchema = photoModelOutputSchema.extend({
  evidence_id: z.string().max(64),
  label: z.string().max(20),
});
export type PhotoObservation = z.infer<typeof photoObservationSchema>;

/** Output contract from the blueprint (section 8). */
export const aiSummarySchema = z.object({
  incident_summary: z.string().max(2000),
  customer_reported_facts: z.array(z.string().max(500)).max(30),
  missing_information: z.array(z.string().max(300)).max(30),
  follow_up_questions: z.array(z.string().max(300)).max(15),
  evidence_checklist: z
    .array(
      z.object({
        item: z.string().max(60),
        status: z.enum(["provided", "missing", "unclear"]),
      }),
    )
    .max(20),
  uncertainties: z.array(z.string().max(300)).max(20),
  safety_notice: z.literal(SAFETY_NOTICE),
  // Unverified, AI-written notes about each photo. Shown to the officer next to the real photos.
  photo_observations: z.array(photoObservationSchema).max(12).optional(),
});
export type AiSummary = z.infer<typeof aiSummarySchema>;

/** Non-sensitive telemetry only. Never include prompts, narratives or images. */
export const aiTelemetrySchema = z.object({
  task: z.enum(AI_TASKS),
  route: z.enum(AI_ROUTES),
  status: z.enum(["SUCCESS", "FAILED", "REJECTED_OUTPUT"]),
  latencyMs: z.number().int().nonnegative().max(600_000),
  fallbackReason: z.enum(AI_FALLBACK_REASONS).optional(),
  modelId: z.string().max(100).optional(),
  promptVersion: z.string().max(40),
  outputSchemaVersion: z.string().max(40),
});
export type AiTelemetry = z.infer<typeof aiTelemetrySchema>;
