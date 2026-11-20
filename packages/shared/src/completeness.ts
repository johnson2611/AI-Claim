import { EVIDENCE_LABELS } from "./schemas/claim";

export interface ClaimFieldsLike {
  policyReferenceMasked?: string | null;
  incidentAt?: Date | string | null;
  incidentLocation?: string | null;
  incidentType?: string | null;
  narrative?: string | null;
  vehicleDescription?: string | null;
  injuriesReported?: boolean | null;
  otherPartiesInvolved?: boolean | null;
  contactChannel?: string | null;
}

export const MIN_NARRATIVE_LENGTH = 20;

const REQUIRED_FIELDS: { key: keyof ClaimFieldsLike; label: string }[] = [
  { key: "policyReferenceMasked", label: "Policy reference" },
  { key: "incidentAt", label: "Date and time of incident" },
  { key: "incidentLocation", label: "Incident location" },
  { key: "incidentType", label: "Incident type" },
  { key: "narrative", label: "Description of what happened" },
  { key: "vehicleDescription", label: "Vehicle details" },
  { key: "injuriesReported", label: "Whether anyone was injured" },
  { key: "otherPartiesInvolved", label: "Whether another vehicle or person was involved" },
  { key: "contactChannel", label: "Preferred contact channel" },
];

/** Evidence the officer needs; the rest is recommended. */
export const REQUIRED_EVIDENCE = ["DAMAGE"] as const;
export const RECOMMENDED_EVIDENCE = ["FRONT", "REAR", "SIDE", "SCENE"] as const;

export interface Completeness {
  percent: number;
  missingFields: string[];
  missingEvidence: string[];
  recommendedEvidence: string[];
  readyToSubmit: boolean;
}

function isFilled(key: keyof ClaimFieldsLike, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return key === "narrative" ? trimmed.length >= MIN_NARRATIVE_LENGTH : trimmed.length > 0;
  }
  return true;
}

/** Deterministic completeness check. The form validation, not the AI, is the source of truth. */
export function assessCompleteness(claim: ClaimFieldsLike, evidenceLabels: readonly string[]): Completeness {
  const missingFields = REQUIRED_FIELDS.filter((f) => !isFilled(f.key, claim[f.key])).map((f) => f.label);
  const present = new Set(evidenceLabels);
  const missingEvidence = REQUIRED_EVIDENCE.filter((l) => !present.has(l)).map((l) => l.toLowerCase());
  const recommendedEvidence = RECOMMENDED_EVIDENCE.filter((l) => !present.has(l)).map((l) => l.toLowerCase());
  const total = REQUIRED_FIELDS.length + REQUIRED_EVIDENCE.length;
  const done = total - missingFields.length - missingEvidence.length;
  return {
    percent: Math.round((done / total) * 100),
    missingFields,
    missingEvidence,
    recommendedEvidence,
    readyToSubmit: missingFields.length === 0 && missingEvidence.length === 0,
  };
}

export const EVIDENCE_LABEL_TEXT: Record<(typeof EVIDENCE_LABELS)[number], string> = {
  FRONT: "Front of vehicle",
  REAR: "Rear of vehicle",
  SIDE: "Side of vehicle",
  DAMAGE: "Close-up of damage",
  SCENE: "Scene of the incident",
  OTHER: "Other",
};
