import type { ClaimEventItem } from "./api/types";

const PURPOSE_TEXT: Record<string, string> = {
  DATA_PROCESSING: "consent to process the report",
  CLOUD_AI_PROCESSING: "consent to cloud AI",
  IMAGE_ANALYSIS: "consent to photo analysis",
};

/** Human-readable audit line. Never includes claim text. */
export function eventText(e: ClaimEventItem): string {
  if (e.eventType === "CONSENT_GRANTED") {
    const purpose = String(e.metadata?.purpose ?? "");
    return PURPOSE_TEXT[purpose] ?? "consent granted";
  }
  return e.eventType.toLowerCase().replaceAll("_", " ");
}
