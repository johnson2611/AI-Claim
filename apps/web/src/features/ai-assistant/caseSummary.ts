import {
  aiSummarySchema,
  SAFETY_NOTICE,
  type AiSummary,
  type AiTelemetry,
} from "@claims/shared";
import { HybridTaskError, runHybridTask, type InferencePolicy } from "../../lib/firebase/ai";
import { extractJson, redactIdentifiers } from "../../lib/validation/redact";
import { OUTPUT_SCHEMA_VERSION, PROMPT_VERSION, SYSTEM_INSTRUCTION } from "./prompts";

export interface SummaryInput {
  incidentType?: string | null;
  incidentAt?: string | null;
  incidentLocation?: string | null;
  vehicleDescription?: string | null;
  injuriesReported?: boolean | null;
  otherPartiesInvolved?: boolean | null;
  narrative?: string | null;
  evidenceLabels: string[];
  /** Unverified descriptions from the photo check, if it was run. */
  photoNotes?: string[];
}

export class AiTaskError extends Error {
  constructor(
    message: string,
    public telemetry: AiTelemetry,
  ) {
    super(message);
  }
}

const ALL_LABELS = ["FRONT", "REAR", "SIDE", "DAMAGE", "SCENE"];

/** A blank answer must stay blank. The model is told "not answered" rather than being left to guess. */
function yesNo(v: boolean | null | undefined): "yes" | "no" | "not answered" {
  return v === true ? "yes" : v === false ? "no" : "not answered";
}

/** Without cloud consent the task can only run locally; with consent it prefers local and may fall back. */
export function policyFor(cloudConsent: boolean): InferencePolicy {
  return cloudConsent ? "PREFER_ON_DEVICE" : "ONLY_ON_DEVICE";
}

export async function generateCaseSummary(
  input: SummaryInput,
  cloudConsent: boolean,
): Promise<{ summary: AiSummary; telemetry: AiTelemetry }> {
  const provided = [...new Set(input.evidenceLabels)];
  // Data minimisation: no policy number, no contact details, no photos. Free text is redacted.
  const payload = {
    incident_type: input.incidentType,
    incident_time: input.incidentAt,
    location: input.incidentLocation,
    vehicle: input.vehicleDescription,
    injuries_reported: yesNo(input.injuriesReported),
    other_parties_involved: yesNo(input.otherPartiesInvolved),
    customer_narrative: redactIdentifiers(input.narrative ?? ""),
    photos_already_uploaded: provided.map((l) => l.toLowerCase()),
    photo_notes_unverified: input.photoNotes ?? [],
    photos_still_missing: ALL_LABELS.filter((l) => !provided.includes(l)).map((l) => l.toLowerCase()),
  };
  const base = { task: "CASE_SUMMARY", promptVersion: PROMPT_VERSION, outputSchemaVersion: OUTPUT_SCHEMA_VERSION } as const;

  try {
    const result = await runHybridTask({
      policy: policyFor(cloudConsent),
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: `CUSTOMER DATA (untrusted):\n${JSON.stringify(payload)}`,
      // Validate before anything is shown: malformed or unsupported output is rejected.
      parse: (text) => aiSummarySchema.parse({ ...(extractJson(text) as object), safety_notice: SAFETY_NOTICE }),
    });
    return {
      summary: dropAlreadyProvided(result.data, provided),
      telemetry: { ...base, route: result.route, status: "SUCCESS", latencyMs: result.latencyMs, fallbackReason: result.fallbackReason },
    };
  } catch (e) {
    if (e instanceof HybridTaskError) {
      throw new AiTaskError(e.message, { ...base, route: e.route, status: e.kind, latencyMs: e.latencyMs });
    }
    throw e;
  }
}

/** Safety net for small models: if damage photos exist, do not ask for them again. */
function dropAlreadyProvided(summary: AiSummary, provided: string[]): AiSummary {
  if (!provided.includes("DAMAGE")) return summary;
  const asksForDamagePhotos = (t: string) => /(photo|video|picture|image).*damage|damage.*(photo|video|picture|image)/i.test(t);
  return {
    ...summary,
    missing_information: summary.missing_information.filter((t) => !asksForDamagePhotos(t)),
    follow_up_questions: summary.follow_up_questions.filter((t) => !asksForDamagePhotos(t)),
  };
}
