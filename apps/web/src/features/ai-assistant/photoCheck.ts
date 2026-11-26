import {
  EVIDENCE_LABEL_TEXT,
  PHOTO_OBSERVATION_SCHEMA_VERSION,
  photoModelOutputSchema,
  keepCompliantSentences,
  violatesPhotoRules,
  type AiTelemetry,
  type EvidenceLabel,
  type PhotoObservation,
} from "@claims/shared";
import { HybridTaskError, runHybridTask, type InferencePolicy } from "../../lib/firebase/ai";
import type { PreparedImage } from "../../lib/imaging";
import { extractJson } from "../../lib/validation/redact";
import { AiTaskError } from "./caseSummary";
import { PHOTO_PROMPT_VERSION, PHOTO_RETRY_REMINDER, PHOTO_SYSTEM_INSTRUCTION } from "./prompts";

/** Without cloud-photo consent the photo never leaves the device. */
export function photoPolicyFor(cloudConsent: boolean): InferencePolicy {
  return cloudConsent ? "PREFER_ON_DEVICE" : "ONLY_ON_DEVICE";
}

function normalise(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);
  return { ...r, photo_quality: lower(r.photo_quality), matches_label: lower(r.matches_label) };
}

async function attempt(input: {
  evidenceId: string;
  label: string;
  image: PreparedImage;
  cloudConsent: boolean;
  retry: boolean;
}): Promise<{ observation: PhotoObservation; telemetry: AiTelemetry }> {
  const labelText = EVIDENCE_LABEL_TEXT[input.label as EvidenceLabel] ?? input.label;
  const base = { task: "IMAGE_CHECK", promptVersion: PHOTO_PROMPT_VERSION, outputSchemaVersion: PHOTO_OBSERVATION_SCHEMA_VERSION } as const;

  try {
    const result = await runHybridTask({
      policy: photoPolicyFor(input.cloudConsent),
      systemInstruction: PHOTO_SYSTEM_INSTRUCTION,
      prompt: `The customer chose this category for the photo: "${labelText}".${input.retry ? `\n${PHOTO_RETRY_REMINDER}` : ""}`,
      images: [input.image],
      parse: (text) => {
        try {
          const parsed = photoModelOutputSchema.parse(normalise(extractJson(text)));
          // Keep the compliant sentences. A single bad sentence no longer discards a good description.
          const description = keepCompliantSentences(parsed.visible_description);
          if (!description) throw new Error("No compliant description left after the safety checks");
          return {
            ...parsed,
            visible_description: description,
            uncertainties: parsed.uncertainties.filter((u) => !violatesPhotoRules([u])),
          };
        } catch (e) {
          console.warn("Photo check output rejected:", e instanceof Error ? e.message : "unknown reason");
          throw e;
        }
      },
    });
    return {
      observation: { ...result.data, evidence_id: input.evidenceId, label: input.label },
      telemetry: { ...base, route: result.route, status: "SUCCESS", latencyMs: result.latencyMs, fallbackReason: result.fallbackReason },
    };
  } catch (e) {
    if (e instanceof HybridTaskError) {
      throw new AiTaskError(e.message, { ...base, route: e.route, status: e.kind, latencyMs: e.latencyMs });
    }
    throw e;
  }
}

/** One automatic retry, only when the first answer was rejected for breaking the rules or the format. */
export async function checkPhoto(input: {
  evidenceId: string;
  label: string;
  image: PreparedImage;
  cloudConsent: boolean;
}): Promise<{ observation: PhotoObservation; telemetry: AiTelemetry }> {
  try {
    return await attempt({ ...input, retry: false });
  } catch (e) {
    if (e instanceof AiTaskError && e.telemetry.status === "REJECTED_OUTPUT") {
      return attempt({ ...input, retry: true });
    }
    throw e;
  }
}
